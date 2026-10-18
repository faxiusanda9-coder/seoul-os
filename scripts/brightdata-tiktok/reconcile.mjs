// Account figures are maintained observations, not an invented billing API.
// This command never receives the Bright Data key or contacts Bright Data.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isInstant } from "../../data/schemas/social.schema.ts";
import { BrightDataError, safeBrightDataError } from "./budget.mjs";

export function reconcileProbe(
  probe,
  after,
  { expectedRunId, defaultBranch } = {},
) {
  if (
    expectedRunId !== undefined &&
    (!/^\d+$/.test(expectedRunId) ||
      !defaultBranch ||
      probe?.executionContext?.runId !== expectedRunId ||
      probe.executionContext.eventName !== "workflow_dispatch" ||
      probe.executionContext.ref !== `refs/heads/${defaultBranch}` ||
      !probe.executionContext.workflowRef?.endsWith(
        `/.github/workflows/brightdata-tiktok.yml@refs/heads/${defaultBranch}`,
      ))
  )
    throw new BrightDataError("PROBE_RUN_PROVENANCE_MISMATCH");
  const before = probe?.accounting?.before;
  const id = probe?.liveValidation?.snapshotIds?.[0];
  if (
    probe?.mode !== "probe" ||
    !probe.liveValidation?.requestSent ||
    !probe.liveValidation.authorValidated ||
    probe.liveValidation.returnedCount !== 1 ||
    probe.liveValidation.snapshotIds.length !== 1 ||
    !before ||
    !isInstant(probe.checkedAt) ||
    !Number.isSafeInteger(before.freeCredits?.remaining) ||
    before.freeCredits.remaining < 0 ||
    !(
      before.balance?.amountUsd === null ||
      (Number.isFinite(before.balance?.amountUsd) &&
        before.balance.amountUsd >= 0)
    ) ||
    probe.preview?.length !== 1 ||
    probe.preview[0].authorHandle !== "itzyofficial" ||
    probe.contentWrites !== 0 ||
    after?.snapshotId !== id ||
    !Number.isSafeInteger(after.freeCreditsRemaining) ||
    after.freeCreditsRemaining < 0 ||
    !Number.isFinite(after.balanceUsd) ||
    after.balanceUsd < 0 ||
    !(
      after.cashSpendUsd === null ||
      (Number.isFinite(after.cashSpendUsd) && after.cashSpendUsd >= 0)
    ) ||
    !isInstant(after.observedAt) ||
    Date.parse(after.observedAt) < Date.parse(probe.checkedAt) ||
    ![null, false, true].includes(after.autoRecharge) ||
    !["pending", "confirmed"].includes(after.billingStatus) ||
    typeof after.evidenceRef !== "string" ||
    after.evidenceRef.length > 300
  )
    throw new BrightDataError("INVALID_PROBE_RECONCILIATION");
  const consumed = before.freeCredits.remaining - after.freeCreditsRemaining;
  const balanceChange =
    before.balance.amountUsd === null
      ? null
      : after.balanceUsd - before.balance.amountUsd;
  const bounded =
    consumed >= 0 && consumed <= probe.accounting.probeReservedCredits;
  const verified =
    after.billingStatus === "confirmed" &&
    !!after.evidenceRef.trim() &&
    bounded &&
    balanceChange === 0 &&
    after.cashSpendUsd === 0;
  return {
    mode: "reconcile",
    checkedAt: new Date().toISOString(),
    requests: 0,
    contentWrites: 0,
    probe,
    accounting: {
      before,
      after: {
        freeCreditsRemaining: after.freeCreditsRemaining,
        balanceUsd: after.balanceUsd,
        cashSpendUsd: after.cashSpendUsd,
        autoRecharge: after.autoRecharge,
        observedAt: after.observedAt,
        source: "maintainer-reported",
      },
      actualCreditsConsumed: consumed,
      actualBalanceChangeUsd: balanceChange,
      actualCashSpendUsd: after.cashSpendUsd,
      billingVerified: verified,
      verificationSource: "maintainer-confirmed; not provider API",
      evidenceRecorded: !!after.evidenceRef.trim(),
      status: verified
        ? "confirmed-zero-additional-cost"
        : "unverified-or-cost-mismatch",
    },
    scheduleEnabledByThisCommand: false,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (!process.env.PROBE_RUN_ID || !process.env.BRIGHTDATA_DEFAULT_BRANCH)
      throw new BrightDataError("PROBE_RUN_PROVENANCE_REQUIRED");
    const report = reconcileProbe(
      JSON.parse(
        await readFile(
          "test-results/probe-input/brightdata-summary.json",
          "utf8",
        ),
      ),
      JSON.parse(process.env.ACCOUNT_AFTER_JSON || "null"),
      {
        expectedRunId: process.env.PROBE_RUN_ID,
        defaultBranch: process.env.BRIGHTDATA_DEFAULT_BRANCH,
      },
    );
    await writeFile(
      "test-results/brightdata-summary.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        mode: report.mode,
        requests: 0,
        billingVerified: report.accounting.billingVerified,
      }),
    );
    if (!report.accounting.billingVerified) process.exitCode = 1;
  } catch (e) {
    await writeFile(
      "test-results/brightdata-summary.json",
      JSON.stringify({
        mode: "reconcile",
        requests: 0,
        error: safeBrightDataError(e),
        billingVerified: false,
      }) + "\n",
    );
    process.exitCode = 1;
  }
}
