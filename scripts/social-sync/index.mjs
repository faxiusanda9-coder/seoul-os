import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadChannels } from "../youtube-sync.mjs";
import {
  parseSocialAccounts,
  parseSocialSnapshot,
  socialIdentity,
} from "../../data/schemas/social.schema.ts";
import { atomicJson, readStatus, updateStatus } from "../sync-status.mjs";

export async function loadSocialAccounts(root = resolve("data")) {
  const artists = new Set(
    (await loadChannels()).filter((c) => c.enabled).map((c) => c.artistId),
  );
  const accounts = parseSocialAccounts(
    JSON.parse(await readFile(resolve(root, "social/accounts.json"), "utf8")),
    artists,
  );
  if (!accounts) throw new Error("Official account registry failed validation");
  return accounts;
}
export async function loadSocial(platform, accounts, root = resolve("data")) {
  const snapshot = parseSocialSnapshot(
    JSON.parse(
      await readFile(resolve(root, `social/${platform}/items.json`), "utf8"),
    ),
    platform,
    accounts,
  );
  if (!snapshot)
    throw new Error(`${platform}: reviewed link manifest failed validation`);
  return snapshot;
}
// This command validates reviewed local manifests only. It never discovers media or probes web pages.
export async function validateSocial({
  root = resolve("data"),
  now = new Date().toISOString(),
} = {}) {
  const accounts = await loadSocialAccounts(root);
  const channels = (await loadChannels()).filter((c) => c.enabled);
  const failures = [];
  for (const platform of ["instagram", "tiktok"]) {
    const statusFile = resolve(root, `status/${platform}.json`);
    let snapshot;
    try {
      snapshot = await loadSocial(platform, accounts, root);
    } catch {
      failures.push(platform);
    }
    for (const c of channels) {
      const sourceId = `${platform}:${c.artistId}`;
      const old = (await readStatus(statusFile)).sources.find(
        (s) => s.sourceId === sourceId,
      );
      await updateStatus(statusFile, {
        sourceId,
        artistId: c.artistId,
        platform,
        mode: "manual-validation",
        status: snapshot ? "ok" : "failed",
        lastAttemptAt: now,
        lastSuccessAt: snapshot ? now : (old?.lastSuccessAt ?? null),
        lastContentChangeAt: old?.lastContentChangeAt ?? null,
        newCount: 0,
        updatedCount: 0,
        itemCount:
          snapshot?.items.filter((i) => i.artistId === c.artistId).length ??
          old?.itemCount ??
          0,
        failedSources: snapshot
          ? []
          : [
              {
                sourceId,
                error: "Reviewed link manifest failed local validation",
              },
            ],
      });
    }
  }
  return failures;
}
export async function importReviewed(
  candidates,
  {
    reviewer,
    accounts,
    root = resolve("data"),
    now = new Date().toISOString(),
  } = {},
) {
  if (typeof reviewer !== "string" || !reviewer.trim())
    throw new Error("A named reviewer is required");
  if (!Array.isArray(candidates) || !candidates.length)
    throw new Error("Provide a nonempty JSON array of reviewed links");
  // Validate the complete batch before any writes. Unknown dates remain null, never inferred from video IDs.
  const groups = new Map();
  const seen = new Set();
  for (const c of candidates) {
    if (!["instagram", "tiktok"].includes(c?.platform))
      throw new Error("Unsupported platform");
    const a = accounts.find(
      (a) => a.artistId === c.artistId && a.platform === c.platform,
    );
    const identity = socialIdentity(c.platform, c.sourceUrl);
    if (!a || !identity || c.confirmedAccountUrl !== a.accountUrl)
      throw new Error(
        "Reviewer must confirm the actual original author against the verified account URL",
      );
    if (seen.has(identity.id))
      throw new Error("Duplicate content ID in import batch");
    seen.add(identity.id);
    const item = {
      id: identity.id,
      artistId: c.artistId,
      platform: c.platform,
      contentType:
        c.platform === "tiktok"
          ? "short-video"
          : identity.kind === "reel"
            ? "reels"
            : "post",
      title: c.title ?? null,
      description: c.description ?? null,
      thumbnail: null,
      publishedAt: c.publishedAt ?? null,
      sourceUrl: c.sourceUrl,
      embedUrl: identity.embedUrl,
      officialAccountUrl: a.accountUrl,
      verificationStatus: "manual-verified",
      acquisitionMethod: "manual-verified",
      fetchedAt: now,
      lastValidatedAt: now,
      availabilityStatus: c.availabilityStatus ?? "unknown",
      evidenceUrl: c.evidenceUrl,
      evidenceNote: c.evidenceNote,
      reviewedBy: reviewer.trim(),
    };
    if (
      !parseSocialSnapshot(
        { schemaVersion: 1, platform: c.platform, items: [item] },
        c.platform,
        accounts,
      )
    )
      throw new Error("Invalid reviewed item, evidence or timestamp");
    groups.set(c.platform, [...(groups.get(c.platform) ?? []), item]);
  }
  const prepared = [];
  for (const [platform, items] of groups) {
    const old = await loadSocial(platform, accounts, root);
    const byId = new Map(old.items.map((i) => [i.id, i]));
    const counts = new Map();
    const metadata = ({ fetchedAt: _f, lastValidatedAt: _v, ...rest }) => rest;
    for (const i of items) {
      if (byId.has(i.id) && byId.get(i.id).artistId !== i.artistId)
        throw new Error("Content cannot be reassigned to another artist");
      const count = counts.get(i.artistId) ?? { newCount: 0, updatedCount: 0 };
      if (byId.has(i.id)) {
        const before = byId.get(i.id);
        i.fetchedAt = before.fetchedAt;
        if (JSON.stringify(metadata(before)) !== JSON.stringify(metadata(i)))
          count.updatedCount++;
      } else count.newCount++;
      counts.set(i.artistId, count);
      byId.set(i.id, i);
    }
    const next = { schemaVersion: 1, platform, items: [...byId.values()] };
    if (!parseSocialSnapshot(next, platform, accounts))
      throw new Error("Merged manifest failed validation");
    prepared.push({ platform, next, counts });
  }
  for (const { platform, next, counts } of prepared) {
    await atomicJson(resolve(root, `social/${platform}/items.json`), next);
    for (const [artistId, count] of counts) {
      const sourceId = `${platform}:${artistId}`;
      const previous = (
        await readStatus(resolve(root, `status/${platform}.json`))
      ).sources.find((s) => s.sourceId === sourceId);
      await updateStatus(resolve(root, `status/${platform}.json`), {
        sourceId,
        artistId,
        platform,
        mode: "manual-validation",
        status: "ok",
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastContentChangeAt:
          count.newCount + count.updatedCount > 0
            ? now
            : (previous?.lastContentChangeAt ?? null),
        ...count,
        itemCount: next.items.filter((i) => i.artistId === artistId).length,
        failedSources: [],
      });
    }
  }
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
    const command = process.argv[2] ?? "validate";
    if (command === "import") {
      if (!get("file")) throw new Error("--file is required");
      const candidates = JSON.parse(
        await readFile(resolve(get("file")), "utf8"),
      );
      await importReviewed(candidates, {
        reviewer: get("reviewer"),
        accounts: await loadSocialAccounts(),
      });
      console.log(
        "Imported reviewed links. This is a manual import, not an automatic platform sync.",
      );
    } else if (command !== "validate")
      throw new Error("Use validate or import");
    const failures = command === "import" ? [] : await validateSocial();
    console.log(
      "Local manifest validation completed; no platform discovery or remote availability check was performed.",
    );
    if (failures.length) process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
