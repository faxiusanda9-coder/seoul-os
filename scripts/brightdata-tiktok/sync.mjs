import { readFile, mkdir, open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { loadSocialAccounts, loadSocial } from "../social-sync/index.mjs";
import { atomicJson } from "../sync-status.mjs";
import {
  parseSocialSnapshot,
  isInstant,
} from "../../data/schemas/social.schema.ts";
import {
  BRIGHTDATA_DATASET,
  BRIGHTDATA_PROVIDER,
  BRIGHTDATA_MONTHLY_LIMIT,
  parseBrightDataStatus,
} from "../../data/schemas/brightdata.schema.ts";
import {
  BrightDataError,
  safeBrightDataError,
  parseLedger,
  reservedThisMonth,
  checkPermissionAndBudget,
  reserve,
  checkSlot,
} from "./budget.mjs";
import {
  triggerRequest,
  collectProfile,
  normalizeRows,
  mergeBrightData,
} from "./adapter.mjs";
import { pushSyncChanges } from "../push-sync-changes.mjs";

export function emptyBrightDataStatus(accounts) {
  return {
    schemaVersion: 1,
    provider: BRIGHTDATA_PROVIDER,
    datasetId: BRIGHTDATA_DATASET,
    schedule: "0 0,12 * * *",
    budget: {
      month: null,
      recordLimit: BRIGHTDATA_MONTHLY_LIMIT,
      reservedRecords: 0,
      deliveredRecords: 0,
      remainingRecords: null,
      paidSpendLimitUsd: 0,
      paidSpendUsd: null,
      confirmationValidUntil: null,
    },
    sources: accounts
      .filter((a) => a.platform === "tiktok")
      .map((a) => ({
        artistId: a.artistId,
        accountUrl: a.accountUrl,
        state: "not-configured",
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastContentChangeAt: null,
        newCount: null,
        updatedCount: null,
        returnedCount: null,
        error: null,
      })),
  };
}
async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
export async function syncBrightData({
  root = resolve("data"),
  env = process.env,
  mode = "plan",
  artist = "all",
  limit = 8,
  clock = () => new Date().toISOString(),
  fetcher = fetch,
  sleep,
  maxPolls,
  persistBudget,
  slot,
} = {}) {
  const now = clock();
  if (
    !["plan", "probe", "sync"].includes(mode) ||
    !isInstant(now) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 8 ||
    (mode === "probe" && (artist !== "itzy" || limit !== 1))
  )
    throw new BrightDataError("INVALID_BRIGHTDATA_OPTIONS");
  const accounts = await loadSocialAccounts(root),
    targets = accounts.filter(
      (a) =>
        a.platform === "tiktok" && (artist === "all" || a.artistId === artist),
    );
  if (
    accounts.filter((a) => a.platform === "tiktok").length !== 8 ||
    !targets.length
  )
    throw new BrightDataError("INVALID_VERIFIED_ACCOUNT_COVERAGE");
  let snapshot = await loadSocial("tiktok", accounts, root);
  const statusFile = resolve(root, "status/brightdata-tiktok.json"),
    ledgerFile = resolve(root, "usage/brightdata-tiktok.json");
  // Missing/corrupt ledger or status is a hard stop; never reset usage to zero.
  const status = parseBrightDataStatus(await readJson(statusFile), accounts);
  if (!status) throw new BrightDataError("INVALID_BRIGHTDATA_STATUS");
  let ledger = parseLedger(await readJson(ledgerFile));
  const summary = {
    mode,
    checkedAt: now,
    provider: BRIGHTDATA_PROVIDER,
    requests: 0,
    connected: false,
    contentWrites: 0,
    sources: [],
    preview: [],
    budget: null,
  };
  if (mode === "plan") {
    let reason = null;
    try {
      checkPermissionAndBudget(env, ledger, now, targets.length * limit);
    } catch (e) {
      reason = safeBrightDataError(e);
    }
    summary.sources = targets.map((a) => ({
      artistId: a.artistId,
      state: reason ? "blocked" : "planned",
      error: reason,
      request: triggerRequest(a, limit),
    }));
    summary.budget = {
      month: now.slice(0, 7),
      recordLimit: BRIGHTDATA_MONTHLY_LIMIT,
      reservedRecords: reservedThisMonth(ledger, now.slice(0, 7)),
      paidSpendLimitUsd: 0,
      paidSpendUsd: null,
    };
    return summary; // Offline plan never calls the provider or changes files.
  }
  await mkdir(resolve(root, "usage"), { recursive: true });
  const lockFile = resolve(root, "usage/brightdata-tiktok.lock");
  let lock;
  try {
    lock = await open(lockFile, "wx");
  } catch {
    throw new BrightDataError("BUDGET_LEDGER_LOCKED");
  }
  const persist = async () => {
    parseLedger(ledger);
    await atomicJson(ledgerFile, ledger);
    if (persistBudget) await persistBudget();
  };
  const updateBudget = (permission = null) => {
    const month = clock().slice(0, 7),
      used = reservedThisMonth(ledger, month);
    status.budget = {
      month,
      recordLimit: BRIGHTDATA_MONTHLY_LIMIT,
      reservedRecords: used,
      deliveredRecords: ledger.reservations
        .filter((r) => r.month === month)
        .reduce((n, r) => n + (r.recordCount ?? 0), 0),
      remainingRecords: permission?.remaining ?? null,
      paidSpendLimitUsd: 0,
      paidSpendUsd: null,
      confirmationValidUntil: permission?.expiresAt ?? null,
    };
    summary.budget = status.budget;
  };
  try {
    ledger = parseLedger(await readJson(ledgerFile));
    const runSlot = checkSlot(now, mode, slot);
    const unreserved = targets.filter(
      (a) =>
        !ledger.reservations.some(
          (r) => r.artistId === a.artistId && r.slot === runSlot,
        ),
    );
    let permission,
      stop = null,
      contentChanged = false;
    try {
      permission = checkPermissionAndBudget(
        env,
        ledger,
        now,
        unreserved.length * limit,
      );
    } catch (e) {
      stop = safeBrightDataError(e);
    }
    for (const account of targets) {
      const s = status.sources.find((s) => s.artistId === account.artistId);
      if (stop) {
        Object.assign(s, {
          state:
            stop === "BRIGHTDATA_TOKEN_MISSING" ? "not-configured" : "blocked",
          lastAttemptAt: clock(),
          newCount: null,
          updatedCount: null,
          returnedCount: null,
          error: stop,
        });
        summary.sources.push({ ...s });
        continue;
      }
      if (!unreserved.includes(account)) {
        // A workflow re-run cannot spend again in the same account/12h slot.
        summary.sources.push({
          artistId: account.artistId,
          state: "skipped",
          error: "SLOT_ALREADY_RESERVED",
        });
        continue;
      }
      const attempt = clock();
      Object.assign(s, {
        lastAttemptAt: attempt,
        newCount: null,
        updatedCount: null,
        returnedCount: null,
        error: null,
      });
      let reservation;
      try {
        permission = checkPermissionAndBudget(env, ledger, attempt, limit);
        reservation = reserve(
          ledger,
          account,
          runSlot,
          limit,
          attempt,
          permission.fingerprint,
        );
        // Durable reservation MUST complete (including remote Git push in CI)
        // before the billable POST. Failed/ambiguous jobs never refund credits.
        await persist();
        const result = await collectProfile(account, {
          limit,
          token: env.BRIGHTDATA_API_TOKEN,
          fetcher: async (...args) => {
            summary.requests++;
            return fetcher(...args);
          },
          sleep,
          maxPolls,
          onSnapshot: async (id) => {
            reservation.snapshotId = id;
            await persist();
          },
          onTerminal: async () => {
            reservation.state = "failed";
            reservation.completedAt = clock();
            await persist();
          },
        });
        const completed = clock();
        if (
          !isInstant(completed) ||
          Date.parse(completed) < Date.parse(attempt)
        )
          throw new BrightDataError("INVALID_COMPLETION_CLOCK");
        reservation.recordCount = result.rows.length;
        // Even rejected provider rows count toward the conservative reservation.
        reservation.state = "complete";
        reservation.completedAt = completed;
        await persist();
        const incoming = normalizeRows(result.rows, account, {
          snapshotId: result.snapshotId,
          now: completed,
          limit,
        });
        if (mode === "probe" && !incoming.length)
          throw new BrightDataError("BRIGHTDATA_EMPTY_PROBE");
        const merged = mergeBrightData(snapshot, incoming);
        if (!parseSocialSnapshot(merged.snapshot, "tiktok", accounts))
          throw new BrightDataError("BRIGHTDATA_CONTENT_VALIDATION_FAILED");
        summary.connected = true;
        summary.preview.push(
          ...incoming.map((i) => ({
            id: i.id,
            authorHandle: i.thirdPartyEvidence.authorHandle,
            publishedAt: i.publishedAt,
            sourceUrl: i.sourceUrl,
            snapshotId: result.snapshotId,
          })),
        );
        Object.assign(s, {
          state: "ok",
          lastSuccessAt: completed,
          lastContentChangeAt:
            mode === "sync" && (merged.newCount || merged.updatedCount)
              ? completed
              : s.lastContentChangeAt,
          newCount: merged.newCount,
          updatedCount: merged.updatedCount,
          returnedCount: result.rows.length,
        });
        if (mode === "sync") {
          snapshot = merged.snapshot;
          contentChanged = true;
        }
      } catch (e) {
        const error = safeBrightDataError(e);
        Object.assign(s, {
          state: "failed",
          newCount: null,
          updatedCount: null,
          returnedCount: null,
          error,
        });
        stop = "STOPPED_AFTER_PROVIDER_FAILURE";
      }
      summary.sources.push(
        mode === "probe"
          ? {
              ...s,
              proposedNewCount: s.newCount,
              proposedUpdatedCount: s.updatedCount,
              newCount: null,
              updatedCount: null,
            }
          : { ...s },
      );
    }
    try {
      permission = checkPermissionAndBudget(env, ledger, clock(), 0);
    } catch {
      permission = null;
    }
    updateBudget(permission);
    if (mode === "sync") {
      if (!parseBrightDataStatus(status, accounts))
        throw new BrightDataError("INVALID_GENERATED_BRIGHTDATA_STATUS");
      if (contentChanged) {
        await atomicJson(resolve(root, "social/tiktok/items.json"), snapshot);
        summary.contentWrites = 1;
      }
      await atomicJson(statusFile, status);
    }
    return summary;
  } finally {
    await lock.close();
    await unlink(lockFile);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const get = (name) =>
    process.argv
      .find((a) => a.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const allowed = new Set(["mode", "artist", "limit"]);
  try {
    if (
      process.argv
        .slice(2)
        .some(
          (a) =>
            a !== "--persist-git" && !allowed.has(a.slice(2).split("=")[0]),
        )
    )
      throw new BrightDataError("INVALID_BRIGHTDATA_OPTIONS");
    const mode = get("mode") ?? "plan";
    const persistGit = process.argv.includes("--persist-git");
    if (
      persistGit &&
      execFileSync("git", ["branch", "--show-current"], {
        encoding: "utf8",
      }).trim() !== "main"
    )
      throw new BrightDataError("LIVE_WORKFLOW_REQUIRES_MAIN");
    const result = await syncBrightData({
      mode,
      artist: get("artist") ?? "all",
      limit: Number(get("limit") ?? (mode === "probe" ? 1 : 8)),
      persistBudget: persistGit
        ? async () => {
            pushSyncChanges({ scope: "brightdata-budget" });
          }
        : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
    if (
      result.sources.some((s) =>
        ["blocked", "not-configured", "failed"].includes(s.state),
      )
    )
      process.exitCode = 1;
  } catch (e) {
    console.error(
      JSON.stringify({ error: safeBrightDataError(e), connected: false }),
    );
    process.exitCode = 1;
  }
}
