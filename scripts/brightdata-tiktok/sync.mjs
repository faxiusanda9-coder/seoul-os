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
  reservedCredits,
  checkPermissionAndBudget,
  reserve,
  checkSlot,
} from "./budget.mjs";
import {
  triggerRequest,
  collectProfile,
  normalizeCollectedRows,
  mergeBrightData,
  failedRowEvidence,
} from "./adapter.mjs";
import { gitBudgetStore } from "./budget-store.mjs";
import { emptyRunSummary } from "./launch.mjs";

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
  const permissionContext = { mode, artist, limit };
  if (
    !["plan", "probe", "sync"].includes(mode) ||
    !isInstant(now) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 8 ||
    (mode === "probe" && (artist !== "itzy" || limit !== 1))
  )
    throw new BrightDataError("INVALID_BRIGHTDATA_OPTIONS");
  const summary = emptyRunSummary(mode, now);
  // A separate collection switch: manual probe permission cannot enable sync.
  // Stop before reading data, acquiring locks or loading/persisting any ledger.
  if (mode === "sync" && env.BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED !== "true")
    return {
      ...summary,
      executionStatus: "disabled",
      reason: "SCHEDULE_NOT_ENABLED",
      message: "定时采集尚未启用。",
    };
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
  if (mode === "plan") {
    summary.executionStatus = "offline-plan";
    // Inspect only the local mirror. Plan must never read credentials/approval,
    // fetch the authoritative ledger, reserve records or imply live readiness.
    const month = now.slice(0, 7),
      used = reservedThisMonth(ledger, month),
      remaining = BRIGHTDATA_MONTHLY_LIMIT - used,
      requested = targets.length * limit,
      unresolved = ledger.reservations.filter((r) => r.state === "reserved");
    const reason = unresolved.length
      ? "UNRESOLVED_PROVIDER_JOB"
      : remaining < requested
        ? "FREE_RECORD_BUDGET_EXHAUSTED"
        : null;
    summary.configuration = {
      validated: true,
      artistIds: targets.map((a) => a.artistId),
      perAccountLimit: limit,
      schedule: scope.schedule,
    };
    summary.liveReadiness = {
      canSendRequests: false,
      apiSecret: "not-inspected",
      apiPermission: "not-inspected",
      zeroCostEvidence: "not-inspected",
      remoteBudget: "not-read",
    };
    summary.sources = targets.map((a) => ({
      artistId: a.artistId,
      accountUrl: a.accountUrl,
      state: reason ? "blocked" : "planned",
      error: reason,
      request: triggerRequest(a, limit),
    }));
    summary.budget = {
      month,
      recordLimit: BRIGHTDATA_MONTHLY_LIMIT,
      source: "local-mirror",
      authoritative: false,
      reservedRecords: used,
      reservedCredits: reservedCredits(ledger, month),
      legacyReservedRecords: ledger.reservations
        .filter((r) => r.month === month && r.creditLimit === undefined)
        .reduce((n, r) => n + r.limit, 0),
      deliveredRecords: ledger.reservations
        .filter((r) => r.month === month)
        .reduce((n, r) => n + (r.recordCount ?? 0), 0),
      remainingInternalRecords: remaining,
      requestedRecords: requested,
      unresolvedTaskCount: unresolved.length,
      providerFreeCreditsRemaining: null,
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
        permissionContext,
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
        permission = checkPermissionAndBudget(
          env,
          ledger,
          attempt,
          limit,
          permissionContext,
        );
        if (permission.observation)
          summary.accounting = {
            before: permission.observation,
            after: null,
            actualCreditChange: null,
            actualBalanceChangeUsd: null,
            actualCashSpendUsd: null,
            billingVerified: false,
            status: "awaiting-account-reconciliation",
          };
        reservation = reserve(
          ledger,
          account,
          runSlot,
          limit,
          attempt,
          permission.fingerprint,
          permission,
        );
        if (summary.accounting)
          summary.accounting.probeReservedCredits = reservation.creditLimit;
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
          onUnknownState: async (state) => {
            summary.liveValidation.unrecognizedTaskStates ??= [];
            if (!summary.liveValidation.unrecognizedTaskStates.includes(state))
              summary.liveValidation.unrecognizedTaskStates.push(state);
          },
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
        const collected = normalizeCollectedRows(result.rows, account, {
          snapshotId: result.snapshotId,
          now: completed,
          limit,
        });
        const incoming = collected.items;
        if (mode === "probe" && !incoming.length)
          throw new BrightDataError("BRIGHTDATA_EMPTY_PROBE");
        const merged = mergeBrightData(snapshot, incoming, {
          onlyNew: mode === "sync",
        });
        if (!parseSocialSnapshot(merged.snapshot, "tiktok", accounts))
          throw new BrightDataError("BRIGHTDATA_CONTENT_VALIDATION_FAILED");
        summary.connected = true;
        if (incoming.length) summary.liveValidation.authorValidated = true;
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
          // Rejected provider rows are visible failures, never playable cards.
          // A known, downloaded result can safely leave other accounts running.
          state: collected.rejectedCount ? "failed" : "ok",
          lastSuccessAt:
            incoming.length || !collected.rejectedCount
              ? completed
              : s.lastSuccessAt,
          lastContentChangeAt:
            mode === "sync" && (merged.newCount || merged.updatedCount)
              ? completed
              : s.lastContentChangeAt,
          newCount: merged.newCount,
          updatedCount: merged.updatedCount,
          returnedCount: result.rows.length,
          error: collected.rejectedCount
            ? incoming.length
              ? "BRIGHTDATA_PARTIAL_RESULT"
              : "BRIGHTDATA_RECORD_ERROR"
            : null,
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
      permission = checkPermissionAndBudget(
        env,
        ledger,
        clock(),
        0,
        permissionContext,
      );
    } catch {
      permission = null;
    }
    updateBudget(permission);
    if (summary.accounting)
      summary.accounting.reservedCredits = reservedCredits(
        ledger,
        now.slice(0, 7),
      );
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
    const live =
      mode === "probe" ||
      (mode === "sync" &&
        process.env.BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED === "true");
    if (
      live &&
      process.env.BRIGHT_DATA_API_KEY &&
      process.env.GITHUB_ACTIONS !== "true"
    )
      throw new BrightDataError("LIVE_REQUESTS_REQUIRE_GITHUB_ACTIONS");
    if (
      live &&
      process.env.BRIGHT_DATA_API_KEY &&
      (!process.env.BRIGHTDATA_DEFAULT_BRANCH ||
        process.env.GITHUB_REF !==
          `refs/heads/${process.env.BRIGHTDATA_DEFAULT_BRANCH}`)
    )
      throw new BrightDataError("DEFAULT_BRANCH_REQUIRED");
    if (live && process.env.BRIGHT_DATA_API_KEY && !persistGit)
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
    if (process.env.GITHUB_ACTIONS === "true")
      result.executionContext = {
        runId: process.env.GITHUB_RUN_ID,
        eventName: process.env.GITHUB_EVENT_NAME,
        ref: process.env.GITHUB_REF,
        workflowRef: process.env.GITHUB_WORKFLOW_REF,
      };
    console.log(JSON.stringify(result, null, 2));
    if (
      mode !== "plan" &&
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
