import { readFile, mkdir, open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
  selectAutomaticAccounts,
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
  failedRowEvidence,
} from "./adapter.mjs";
import { gitBudgetStore } from "./budget-store.mjs";

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
    sources: selectAutomaticAccounts(accounts).map((a) => ({
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
  budgetStore,
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
    automatic = selectAutomaticAccounts(accounts),
    targets = automatic.filter(
      (a) => artist === "all" || a.artistId === artist,
    );
  const scope = await readJson(
    resolve(root, "providers/tiktok-auto-scope.json"),
  );
  if (
    scope.schemaVersion !== 1 ||
    scope.perAccountLimit !== 8 ||
    scope.schedule !== "0 0,12 * * *" ||
    JSON.stringify(scope.artistIds) !==
      JSON.stringify(automatic.map((a) => a.artistId)) ||
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
    liveValidation: {
      requestSent: false,
      apiReturned: false,
      taskSubmitted: false,
      snapshotIds: [],
      resultDownloaded: false,
      returnedCount: null,
      authorValidated: false,
      newestPublishedAt: null,
      billingVerified: false,
      playerPlaybackVerified: false,
    },
    failedRecords: [],
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
    if (budgetStore) await budgetStore.save(ledger);
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
    ledger = parseLedger(
      budgetStore &&
        env.BRIGHT_DATA_API_KEY &&
        env.BRIGHTDATA_TIKTOK_ENABLED === "true"
        ? await budgetStore.load(ledger)
        : await readJson(ledgerFile),
    );
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
          token: env.BRIGHT_DATA_API_KEY,
          fetcher: async (...args) => {
            summary.requests++;
            summary.liveValidation.requestSent = true;
            return fetcher(...args);
          },
          sleep,
          maxPolls,
          onSnapshot: async (id) => {
            summary.liveValidation.apiReturned = true;
            summary.liveValidation.taskSubmitted = true;
            summary.liveValidation.snapshotIds.push(id);
            reservation.snapshotId = id;
            await persist();
          },
          onRows: async (rows) => {
            summary.liveValidation.resultDownloaded = true;
            if (Array.isArray(rows))
              summary.liveValidation.returnedCount =
                (summary.liveValidation.returnedCount ?? 0) + rows.length;
          },
          onTerminal: async () => {
            reservation.state = "failed";
            reservation.completedAt = clock();
            await persist();
          },
        });
        const completed = clock();
        summary.liveValidation.apiReturned = true;
        summary.failedRecords.push(
          ...failedRowEvidence(result.rows, account, result.snapshotId),
        );
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
        const merged = mergeBrightData(snapshot, incoming, {
          onlyNew: mode === "sync",
        });
        if (!parseSocialSnapshot(merged.snapshot, "tiktok", accounts))
          throw new BrightDataError("BRIGHTDATA_CONTENT_VALIDATION_FAILED");
        summary.connected = true;
        summary.liveValidation.authorValidated = true;
        for (const item of incoming)
          if (
            !summary.liveValidation.newestPublishedAt ||
            Date.parse(item.publishedAt) >
              Date.parse(summary.liveValidation.newestPublishedAt)
          )
            summary.liveValidation.newestPublishedAt = item.publishedAt;
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
          contentChanged ||= merged.newCount > 0;
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
      mode !== "plan" &&
      process.env.BRIGHT_DATA_API_KEY &&
      process.env.GITHUB_ACTIONS !== "true"
    )
      throw new BrightDataError("LIVE_REQUESTS_REQUIRE_GITHUB_ACTIONS");
    if (mode !== "plan" && process.env.BRIGHT_DATA_API_KEY && !persistGit)
      throw new BrightDataError("DURABLE_REMOTE_BUDGET_REQUIRED");
    const result = await syncBrightData({
      mode,
      artist: get("artist") ?? "all",
      limit: Number(get("limit") ?? (mode === "probe" ? 1 : 8)),
      budgetStore: persistGit
        ? gitBudgetStore({
            allowCreate: process.env.BRIGHTDATA_BUDGET_INITIALIZE === "true",
          })
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
    console.log(
      JSON.stringify({
        error: safeBrightDataError(e),
        connected: false,
        requestSent: null,
        contentWrites: null,
      }),
    );
    process.exitCode = 1;
  }
}
