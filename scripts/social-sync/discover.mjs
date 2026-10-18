import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadSocialAccounts, loadSocial } from "./index.mjs";
import {
  parseSocialSnapshot,
  isInstant,
} from "../../data/schemas/social.schema.ts";
import {
  parseDiscoveryStatus,
  discoveryProvider,
} from "../../data/schemas/social-discovery.schema.ts";
import { atomicJson } from "../sync-status.mjs";
import { discoverInstagram, discoverTikTok } from "./adapters.mjs";
import {
  readTikTokCredentials,
  tikTokCredentials,
  githubCredentialStore,
} from "./credentials.mjs";
import { DiscoveryError, safeDiscoveryError } from "./http.mjs";
import { expireApiMetadata } from "./retention.mjs";

export async function readDiscovery(root, accounts) {
  try {
    const status = parseDiscoveryStatus(
      JSON.parse(
        await readFile(resolve(root, "status/social-discovery.json"), "utf8"),
      ),
      accounts,
    );
    if (!status) throw new DiscoveryError("INVALID_DISCOVERY_STATUS");
    return status;
  } catch (e) {
    if (e.code === "ENOENT") return { schemaVersion: 1, sources: [] };
    throw e;
  }
}
export function mergeDiscovered(snapshot, incoming, account) {
  const next = new Map(snapshot.items.map((i) => [i.id, i]));
  let newCount = 0,
    updatedCount = 0;
  for (const item of incoming) {
    if (
      [...next.values()].some(
        (i) =>
          i.platform === item.platform &&
          i.apiEvidence?.mediaId === item.apiEvidence.mediaId &&
          i.id !== item.id,
      )
    )
      throw new DiscoveryError("CONTENT_IDENTITY_MISMATCH");
    const old = next.get(item.id);
    if (
      old &&
      (old.artistId !== account.artistId ||
        old.platform !== account.platform ||
        (old.apiEvidence &&
          (old.apiEvidence.mediaId !== item.apiEvidence.mediaId ||
            old.apiEvidence.accountId !== item.apiEvidence.accountId)))
    )
      throw new DiscoveryError("CONTENT_IDENTITY_MISMATCH");
    if (!old) {
      next.set(item.id, item);
      newCount++;
      continue;
    }
    // Keep manual provenance and separate playback/removal evidence. An API list
    // does not undo an editor's removal or establish successful inline playback.
    const merged =
      old.acquisitionMethod === "manual-verified"
        ? { ...old, apiEvidence: item.apiEvidence }
        : {
            ...old,
            title: item.title,
            description: item.description,
            publishedAt: item.publishedAt,
            lastValidatedAt: item.lastValidatedAt,
            apiEvidence: item.apiEvidence,
          };
    // Ignore observation timestamps when counting actual metadata changes.
    const metadata = ({
      fetchedAt: _f,
      lastValidatedAt: _v,
      apiEvidence: _a,
      ...rest
    }) => rest;
    if (JSON.stringify(metadata(old)) !== JSON.stringify(metadata(merged)))
      updatedCount++;
    next.set(item.id, merged);
  }
  return {
    snapshot: { ...snapshot, items: [...next.values()] },
    newCount,
    updatedCount,
  };
}
export async function discoverSocial({
  root = resolve("data"),
  env = process.env,
  platform = "all",
  artist = "all",
  dryRun = false,
  now,
  clock,
  fetcher = fetch,
  sleep,
  maxPages = 20,
  persist,
} = {}) {
  const readClock = clock ?? (now ? () => now : () => new Date().toISOString());
  now ??= readClock();
  if (
    !["all", "instagram", "tiktok"].includes(platform) ||
    !isInstant(now) ||
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 1000
  )
    throw new DiscoveryError("INVALID_DISCOVERY_OPTIONS");
  const accounts = await loadSocialAccounts(root);
  const targets = accounts.filter(
    (a) =>
      (platform === "all" || a.platform === platform) &&
      (artist === "all" || a.artistId === artist),
  );
  if (!targets.length) throw new DiscoveryError("NO_VERIFIED_ACCOUNT");
  const disabled = new Set(
    (env.SOCIAL_DISABLED_SOURCES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (
    [...disabled].some(
      (id) => !accounts.some((a) => `${a.platform}:${a.artistId}` === id),
    )
  )
    throw new DiscoveryError("INVALID_DISABLED_SOURCE");
  const status = await readDiscovery(root, accounts),
    statuses = new Map(status.sources.map((s) => [s.sourceId, s]));
  const summary = {
    dryRun,
    checkedAt: now,
    retentionPrunedCount: 0,
    sources: [],
  };
  let credentials;
  const options = {
    now,
    fetcher,
    sleep,
    maxPages,
    dryRun,
    persist:
      persist ??
      (dryRun ? null : githubCredentialStore(env, { fetcher, sleep })),
  };
  for (const p of ["instagram", "tiktok"].filter((p) =>
    targets.some((a) => a.platform === p),
  )) {
    let snapshot = await loadSocial(p, accounts, root);
    let snapshotChanged = false;
    for (const account of targets.filter((a) => a.platform === p)) {
      const sourceId = `${p}:${account.artistId}`,
        old = statuses.get(sourceId);
      const entry = {
        sourceId,
        artistId: account.artistId,
        platform: p,
        provider: discoveryProvider(p),
        accountUrl: account.accountUrl,
        state: "not-configured",
        lastAttemptAt: readClock(),
        lastCompletedAt: readClock(),
        lastSuccessAt: old?.lastSuccessAt ?? null,
        lastContentChangeAt: old?.lastContentChangeAt ?? null,
        accountVerifiedAt: old?.accountVerifiedAt ?? null,
        newCount: null,
        updatedCount: null,
        itemCount: snapshot.items.filter((i) => i.artistId === account.artistId)
          .length,
        pagesRead: 0,
        failedSources: [],
      };
      try {
        if (disabled.has(sourceId))
          throw new DiscoveryError("AUTOMATION_DISABLED", "disabled");
        const accountOptions = {
          ...options,
          now: entry.lastAttemptAt,
          deadline: Date.now() + 60000,
        };
        let result;
        if (p === "instagram") {
          if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_IG_USER_ID)
            throw new DiscoveryError(
              "INSTAGRAM_CONFIGURATION_MISSING",
              "not-configured",
            );
          if (
            env.INSTAGRAM_ACCESS_TOKEN_EXPIRES_AT &&
            (!isInstant(env.INSTAGRAM_ACCESS_TOKEN_EXPIRES_AT) ||
              Date.parse(env.INSTAGRAM_ACCESS_TOKEN_EXPIRES_AT) <=
                Date.parse(entry.lastAttemptAt))
          )
            throw new DiscoveryError("TOKEN_RENEWAL_REQUIRED", "auth-required");
          result = await discoverInstagram(
            account,
            {
              accessToken: env.INSTAGRAM_ACCESS_TOKEN,
              callerId: env.INSTAGRAM_IG_USER_ID,
            },
            {
              ...accountOptions,
              graphVersion: env.INSTAGRAM_GRAPH_VERSION ?? "v26.0",
            },
          );
        } else {
          credentials ??= readTikTokCredentials(env);
          const credential = await tikTokCredentials(
            account.artistId,
            credentials,
            env,
            accountOptions,
          );
          result = await discoverTikTok(account, credential, {
            ...accountOptions,
            lastSuccessAt: old?.lastSuccessAt,
          });
        }
        const completedAt = readClock();
        if (
          !isInstant(completedAt) ||
          Date.parse(completedAt) < Date.parse(entry.lastAttemptAt)
        )
          throw new DiscoveryError("INVALID_COMPLETION_CLOCK");
        for (const item of result.items) {
          item.fetchedAt = completedAt;
          item.lastValidatedAt = completedAt;
          item.apiEvidence.checkedAt = completedAt;
        }
        const merged = mergeDiscovered(snapshot, result.items, account);
        if (!parseSocialSnapshot(merged.snapshot, p, accounts))
          throw new DiscoveryError("CONTENT_VALIDATION_FAILED");
        snapshot = merged.snapshot;
        snapshotChanged = true;
        Object.assign(entry, {
          state: "ok",
          lastCompletedAt: completedAt,
          lastSuccessAt: completedAt,
          accountVerifiedAt: completedAt,
          newCount: merged.newCount,
          updatedCount: merged.updatedCount,
          pagesRead: result.pagesRead,
          itemCount: snapshot.items.filter(
            (i) => i.artistId === account.artistId,
          ).length,
          lastContentChangeAt:
            merged.newCount + merged.updatedCount > 0
              ? completedAt
              : entry.lastContentChangeAt,
        });
      } catch (error) {
        const safe = safeDiscoveryError(error);
        entry.state = safe.state;
        entry.lastCompletedAt = readClock();
        entry.failedSources =
          safe.state === "disabled" ? [] : [{ sourceId, error: safe.code }];
      }
      statuses.set(sourceId, entry);
      summary.sources.push(entry);
    }
    // Account batches are prepared in memory. Incomplete pagination never writes
    // that account's partial list; successful independent accounts still commit.
    const retained = expireApiMetadata(snapshot, readClock());
    snapshot = retained.snapshot;
    summary.retentionPrunedCount += retained.prunedCount;
    for (const entry of summary.sources.filter((s) => s.platform === p))
      entry.itemCount = snapshot.items.filter(
        (i) => i.artistId === entry.artistId,
      ).length;
    if (!dryRun && (snapshotChanged || retained.prunedCount))
      await atomicJson(resolve(root, `social/${p}/items.json`), snapshot);
  }
  const next = {
    schemaVersion: 1,
    sources: [...statuses.values()].sort((a, b) =>
      a.sourceId.localeCompare(b.sourceId),
    ),
  };
  if (!parseDiscoveryStatus(next, accounts))
    throw new DiscoveryError("INVALID_GENERATED_DISCOVERY_STATUS");
  if (!dryRun)
    await atomicJson(resolve(root, "status/social-discovery.json"), next);
  summary.checkedAt = readClock();
  return summary;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const get = (name) =>
      process.argv
        .find((v) => v.startsWith(`--${name}=`))
        ?.slice(name.length + 3);
    const args = process.argv.slice(2);
    if (
      args.some(
        (v) =>
          !/^--(platform|artist|max-pages)=[\w-]+$/.test(v) &&
          v !== "--dry-run",
      )
    )
      throw new DiscoveryError("INVALID_DISCOVERY_OPTIONS");
    const result = await discoverSocial({
      platform: get("platform") ?? "all",
      artist: get("artist") ?? "all",
      dryRun: args.includes("--dry-run"),
      maxPages: Number(get("max-pages") ?? 20),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.sources.some((s) => !["ok", "disabled"].includes(s.state)))
      process.exitCode = 1;
  } catch (error) {
    console.error(safeDiscoveryError(error).code);
    process.exitCode = 1;
  }
}
