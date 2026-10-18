import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPermissionAndBudget,
  reserve,
} from "../scripts/brightdata-tiktok/budget.mjs";

const now = "2026-10-19T01:00:00Z";
const policy = () => ({
  schemaVersion: 2,
  month: "2026-10",
  confirmedAt: "2026-10-18T17:00:00Z",
  expiresAt: "2026-11-01T00:00:00Z",
  accountRef: "FIXTURE-FREE-ACCOUNT",
  accountExclusive: true,
  publicMetadataUseApproved: true,
  permissionEvidenceRef: "FIXTURE - no live credentials or requests",
  freeCredits: { remaining: 3441, total: 5000, unit: "credits" },
  balance: { amountUsd: 2, kind: "unknown" },
  cashSpend: { amountUsd: null },
  autoRecharge: null,
  paymentMethod: "none-reported",
  noPaymentMethodReported: true,
  baselineReservedCredits: 0,
  baselineLegacyReservedRecords: 0,
  paidSpendLimitUsd: 0,
  holdbackCredits: 441,
  recurringMonthlyFreeTier: true,
  monthlyFreeTierEvidenceRef:
    "https://docs.brightdata.com/general/account/billing-and-pricing/free-tier",
  authorization: {
    approved: true,
    scope: "scheduled-free-only",
    datasetId: "gd_lu702nij2f790tmv9h",
    maxCreditsPerRecord: 1,
    evidenceRef: "FIXTURE",
    freeOnlyHardStopConfirmed: true,
    noBalanceDebitConfirmed: true,
    noCashChargeConfirmed: true,
    noAutomaticRechargeConfirmed: true,
  },
});
const ledger = () => ({
  schemaVersion: 1,
  accountFingerprint: null,
  reservations: [],
});
function check(p = policy(), l = ledger(), time = now, n = 48, mode = "sync") {
  return checkPermissionAndBudget(
    {
      BRIGHT_DATA_API_KEY: "FIXTURE-NOT-A-KEY",
      BRIGHTDATA_TIKTOK_ENABLED: "true",
      BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify(p),
    },
    l,
    time,
    n,
    {
      mode,
      artist: mode === "probe" ? "itzy" : "all",
      limit: mode === "probe" ? 1 : 8,
    },
  );
}
test("reported lack of a payment method permits approved free-only schedule without inventing account observations", () => {
  const r = check();
  assert.equal(r.remaining, 3000);
  assert.deepEqual(r.observation.balance, { amountUsd: 2, kind: "unknown" });
  assert.equal(r.observation.cashSpend.amountUsd, null);
  assert.equal(r.observation.autoRecharge, null);
  assert.equal(r.observation.freeCredits.remaining, 3441);
});
test("unknown, present or unreported payment method cannot use the no-payment exception", () => {
  for (const patch of [
    { noPaymentMethodReported: false },
    { paymentMethod: "unknown" },
    { paymentMethod: "present" },
  ])
    assert.throws(
      () => check({ ...policy(), ...patch }),
      /SCHEDULE_ZERO_COST_APPROVAL_REQUIRED/,
    );
  assert.throws(
    () => check({ ...policy(), autoRecharge: true }),
    /INVALID_SCOPED_ZERO_COST_APPROVAL/,
  );
});
test("credit holdback is conservative and cannot be negative or exceed the allowance", () => {
  for (const holdbackCredits of [-1, 3442, 0.1])
    assert.throws(
      () => check({ ...policy(), holdbackCredits }),
      /INVALID_SCOPED_ZERO_COST_APPROVAL/,
    );
  assert.throws(
    () => check({ ...policy(), holdbackCredits: 3440 }),
    /FREE_RECORD_BUDGET_EXHAUSTED/,
  );
});
test("approved monthly renewal uses published allowance while preserving old reported credit and balance figures", () => {
  const r = check(policy(), ledger(), "2026-11-01T00:01:00Z");
  assert.equal(r.remaining, 4000);
  assert.equal(r.expiresAt, "2026-12-01T00:00:00.000Z");
  assert.equal(r.observation.freeCredits.remaining, 3441);
  assert.equal(r.observation.observedAt, "2026-10-18T17:00:00Z");
  assert.equal(r.observation.budgetAllowance.creditsAtBaseline, 5000);
  assert.equal(
    r.observation.budgetAllowance.source,
    "documented-monthly-renewal-not-account-read",
  );
});
test("monthly renewal requires explicit authorization, official policy evidence and scheduled scope", () => {
  for (const patch of [
    { recurringMonthlyFreeTier: false },
    { monthlyFreeTierEvidenceRef: "" },
    { noPaymentMethodReported: false },
  ])
    assert.throws(
      () => check({ ...policy(), ...patch }, ledger(), "2026-11-02T00:00:00Z"),
      /INVALID_SCOPED_ZERO_COST_APPROVAL/,
    );
  const p = policy();
  p.authorization.scope = "itzy-probe-once";
  assert.throws(
    () => check(p, ledger(), "2026-11-02T00:00:00Z", 1, "probe"),
    /INVALID_SCOPED_ZERO_COST_APPROVAL/,
  );
});
test("monthly renewal never clears an unresolved provider job or refunds a reservation", () => {
  const p = policy(),
    l = ledger(),
    a = check(p);
  reserve(
    l,
    { artistId: "itzy" },
    "2026-10-19T00:00:00.000Z",
    8,
    now,
    a.fingerprint,
    a,
  );
  assert.throws(
    () => check(p, l, "2026-11-02T00:00:00Z"),
    /UNRESOLVED_PROVIDER_JOB/,
  );
  assert.equal(l.reservations.length, 1);
  assert.equal(l.reservations[0].creditLimit, 8);
});
test("current-month expiry remains a hard stop and used credits are deducted from the reported baseline", () => {
  const p = policy(),
    l = ledger(),
    a = check(p);
  const r = reserve(
    l,
    { artistId: "itzy" },
    "2026-10-19T00:00:00.000Z",
    8,
    now,
    a.fingerprint,
    a,
  );
  Object.assign(r, {
    state: "complete",
    recordCount: 3,
    completedAt: now,
    snapshotId: "sd_FIXTUREONLY",
  });
  assert.equal(check(p, l).remaining, 2992);
  assert.throws(
    () => check({ ...p, expiresAt: "2026-10-19T00:00:00Z" }, l),
    /INVALID_SCOPED_ZERO_COST_APPROVAL/,
  );
});
