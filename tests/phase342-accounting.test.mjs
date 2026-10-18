// New Phase 3.4.2 behavior only; not a repeat of the previous 113-test suite.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import {
  checkPermissionAndBudget,
  reserve,
  parseLedger,
  BrightDataError,
} from "../scripts/brightdata-tiktok/budget.mjs";
import { syncBrightData } from "../scripts/brightdata-tiktok/sync.mjs";
import { reconcileProbe } from "../scripts/brightdata-tiktok/reconcile.mjs";
import { selectLaunch } from "../scripts/brightdata-tiktok/launch.mjs";
const now = "2026-10-19T01:00:00Z";
const p = {
  schemaVersion: 2,
  month: "2026-10",
  confirmedAt: "2026-10-19T00:00:00Z",
  expiresAt: "2026-10-20T23:59:00Z",
  accountRef: "NEW_342_CONTROLLED_ACCOUNT",
  accountExclusive: true,
  publicMetadataUseApproved: true,
  permissionEvidenceRef: "FIXTURE_ONLY",
  freeCredits: { remaining: 3441, total: 5000, unit: "credits" },
  balance: { amountUsd: 2, kind: "unknown" },
  cashSpend: { amountUsd: null },
  paymentMethod: "none-reported",
  autoRecharge: null,
  paidSpendLimitUsd: 0,
  baselineReservedCredits: 0,
  baselineLegacyReservedRecords: 0,
  authorization: {
    approved: true,
    scope: "itzy-probe-once",
    datasetId: "gd_lu702nij2f790tmv9h",
    maxCreditsPerRecord: 2,
    evidenceRef: "CONTROLLED GUARANTEE - NOT REAL EVIDENCE",
    freeOnlyHardStopConfirmed: true,
    noBalanceDebitConfirmed: true,
    noCashChargeConfirmed: true,
    noAutomaticRechargeConfirmed: true,
  },
};
const env = (patch = {}) => ({
  BRIGHT_DATA_API_KEY: "FAKE_342_NO_REAL_TOKEN",
  BRIGHTDATA_TIKTOK_ENABLED: "true",
  BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify({ ...p, ...patch }),
});
const ledger = () => ({
  schemaVersion: 1,
  accountFingerprint: null,
  reservations: [],
});
const context = { mode: "probe", artist: "itzy", limit: 1 };
const permission = (l = ledger(), patch = {}, n = 1, c = context) =>
  checkPermissionAndBudget(env(patch), l, now, n, c);
const row = JSON.parse(
  await readFile("docs/phase-3.4/sd_mvdx30v5inbop8r5r.json", "utf8"),
).find((r) => r.account_id === "itzyofficial" && !r.error_code);
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "seoul-phase342-"));
  t.after(async () => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    await rm(dir, { recursive: true, force: true });
  });
  await cp(resolve("data"), join(dir, "data"), { recursive: true });
  return join(dir, "data");
}
const request = (root, extra = {}) =>
  syncBrightData({
    root,
    mode: "probe",
    artist: "itzy",
    limit: 1,
    clock: () => now,
    env: env(),
    ...extra,
  });
const json = (x) => new Response(JSON.stringify(x));
const network = (post) => async (url, options) => {
  if (options.method === "POST") {
    post?.(JSON.parse(options.body));
    return json({ snapshot_id: "sd_PHASE342TEST" });
  }
  if (url.includes("/progress/"))
    return json({
      snapshot_id: "sd_PHASE342TEST",
      dataset_id: "gd_lu702nij2f790tmv9h",
      status: "ready",
    });
  return json([row]);
};
test("v2 keeps 3441 credits, unknown-origin 2 USD balance, null cash spend and unknown auto recharge separate", () => {
  const r = permission();
  assert.equal(r.observation.freeCredits.remaining, 3441);
  assert.equal(r.observation.balance.amountUsd, 2);
  assert.equal(r.observation.balance.kind, "unknown");
  assert.equal(r.observation.cashSpend.amountUsd, null);
  assert.equal(r.observation.autoRecharge, null);
  assert.equal(r.remaining, 1720); // 2 credits/record, not 1:1 assumed
  assert.equal(r.purpose, "itzy-probe-once");
});
test("v2 has one specific missing fee guarantee; account observations alone never authorize a request", () => {
  for (const patch of [
    { approved: false },
    { evidenceRef: "" },
    { freeOnlyHardStopConfirmed: false },
    { noBalanceDebitConfirmed: false },
    { noCashChargeConfirmed: false },
    { noAutomaticRechargeConfirmed: false },
    { maxCreditsPerRecord: null },
  ])
    assert.throws(
      () =>
        permission(ledger(), {
          authorization: { ...p.authorization, ...patch },
        }),
      /FREE_ONLY_GUARANTEE_MISSING/,
    );
  assert.throws(
    () =>
      permission(ledger(), {}, 8, { mode: "sync", artist: "all", limit: 8 }),
    /ZERO_COST_SCOPE_MISMATCH/,
  );
});
test("record and credit reservations are durable separately; a prior probe cannot be repeated on a later day", () => {
  const l = ledger(),
    a = permission(l);
  const r = reserve(
    l,
    { artistId: "itzy" },
    "probe:2026-10-19",
    1,
    now,
    a.fingerprint,
    a,
  );
  assert.equal(r.limit, 1);
  assert.equal(r.creditLimit, 2);
  assert.ok(parseLedger(l));
  assert.throws(() => permission(l), /UNRESOLVED_PROVIDER_JOB/);
  Object.assign(r, {
    state: "complete",
    snapshotId: "sd_PHASE342TEST",
    completedAt: now,
    recordCount: 1,
  });
  assert.throws(() => permission(l), /PROBE_ALREADY_RESERVED/);
  assert.equal(
    checkPermissionAndBudget(env(), l, now, 0, context).remaining,
    1719,
  );
  r.creditLimit = -1;
  assert.throws(() => parseLedger(l), /INVALID_BUDGET_LEDGER/);
});
test("v2 scheduled scope cannot reuse single-use approval and requires explicitly disabled recharge", () => {
  const auth = { ...p.authorization, scope: "scheduled-free-only" };
  assert.throws(
    () =>
      permission(ledger(), { authorization: auth }, 48, {
        mode: "sync",
        artist: "all",
        limit: 8,
      }),
    /SCHEDULE_ZERO_COST_APPROVAL_REQUIRED/,
  );
  const r = permission(
    ledger(),
    { authorization: auth, autoRecharge: false },
    48,
    { mode: "sync", artist: "all", limit: 8 },
  );
  assert.equal(r.purpose, "scheduled-free-only");
  assert.equal(r.remaining, 1720);
  assert.equal(
    selectLaunch({
      event: "schedule",
      ref: "refs/heads/main",
      defaultBranch: "main",
    }).execute,
    false,
  );
});
test("new scoped probe persists 1 record / 2 credits before POST; no public writes and no second POST next day", async (t) => {
  const root = await fixture(t);
  const files = ["social/tiktok/items.json", "status/brightdata-tiktok.json"];
  const before = await Promise.all(
    files.map((f) => readFile(join(root, f), "utf8")),
  );
  let posts = 0,
    saved;
  const result = await request(root, {
    budgetStore: {
      load: async (seed) => structuredClone(seed),
      save: async (l) => {
        saved = structuredClone(l);
      },
    },
    fetcher: network((body) => {
      posts++;
      assert.equal(saved.reservations[0].creditLimit, 2);
      assert.equal(body.limit_per_input, 1);
    }),
  });
  assert.equal(posts, 1);
  assert.equal(result.accounting.before.balance.amountUsd, 2);
  assert.equal(result.accounting.after, null);
  assert.equal(result.accounting.probeReservedCredits, 2);
  assert.equal(result.accounting.actualCashSpendUsd, null);
  assert.equal(result.accounting.billingVerified, false);
  assert.equal(result.liveValidation.returnedCount, 1);
  assert.deepEqual(
    await Promise.all(files.map((f) => readFile(join(root, f), "utf8"))),
    before,
  );
  const again = await request(root, {
    clock: () => "2026-10-20T01:00:00Z",
    fetcher: network(() => {
      posts++;
    }),
  });
  assert.equal(posts, 1);
  assert.equal(again.requests, 0);
  assert.equal(again.sources[0].error, "PROBE_ALREADY_RESERVED");
});
test("missing v2 guarantee or failed durable reservation cannot submit POST", async (t) => {
  for (const conflict of [false, true]) {
    const root = await fixture(t);
    let calls = 0;
    const r = await request(root, {
      env: conflict
        ? env()
        : env({ authorization: { ...p.authorization, approved: false } }),
      budgetStore: {
        load: async (seed) => structuredClone(seed),
        save: async () => {
          throw new BrightDataError("CENTRAL_BUDGET_PERSIST_OR_CONFLICT");
        },
      },
      fetcher: () => {
        calls++;
      },
    });
    assert.equal(calls, 0);
    assert.equal(r.requests, 0);
    assert.equal(
      r.sources[0].error,
      conflict
        ? "CENTRAL_BUDGET_PERSIST_OR_CONFLICT"
        : "FREE_ONLY_GUARANTEE_MISSING",
    );
  }
});
test("reconciliation records actual credit and balance changes and preserves unknown or nonzero cash as unverified", async (t) => {
  const root = await fixture(t),
    probe = await request(root, { fetcher: network() });
  const after = {
    snapshotId: "sd_PHASE342TEST",
    freeCreditsRemaining: 3439,
    balanceUsd: 2,
    cashSpendUsd: 0,
    autoRecharge: false,
    observedAt: "2026-10-19T02:00:00Z",
    billingStatus: "confirmed",
    evidenceRef: "CONTROLLED STATEMENT ONLY",
  };
  const r = reconcileProbe(probe, after);
  assert.equal(r.requests, 0);
  assert.equal(r.accounting.actualCreditsConsumed, 2);
  assert.equal(r.accounting.actualBalanceChangeUsd, 0);
  assert.equal(r.accounting.billingVerified, true);
  assert.equal(r.accounting.before.cashSpend.amountUsd, null);
  assert.equal(r.scheduleEnabledByThisCommand, false);
  for (const patch of [
    { cashSpendUsd: null },
    { cashSpendUsd: 0.01 },
    { balanceUsd: 1.99 },
    { freeCreditsRemaining: 3438 },
    { billingStatus: "pending" },
    { evidenceRef: "" },
  ])
    assert.equal(
      reconcileProbe(probe, { ...after, ...patch }).accounting.billingVerified,
      false,
    );
  assert.throws(
    () => reconcileProbe(probe, { ...after, snapshotId: "sd_WRONGSNAP" }),
    /INVALID_PROBE_RECONCILIATION/,
  );
});
test("reconcile workflow excludes Bright Data secrets, budget writes and deployment", async () => {
  const w = await readFile(".github/workflows/brightdata-tiktok.yml", "utf8");
  assert.match(w, /default: plan/);
  assert.match(w, /mode != 'plan' && steps.launch.outputs.mode != 'reconcile'/);
  const block = w.slice(
    w.indexOf("- name: Download previous"),
    w.indexOf("- name: Upload sanitized"),
  );
  assert.doesNotMatch(block, /secrets\.BRIGHT|--persist-git/);
  assert.match(block, /actions\/download-artifact@v8/);
  assert.equal(
    selectLaunch({
      event: "workflow_dispatch",
      ref: "refs/heads/main",
      defaultBranch: "main",
      requestedMode: "reconcile",
    }).execute,
    true,
  );
});

test("reconciliation run provenance binds default-branch probe artifact to the selected Actions run", async () => {
  const probe = {
    mode: "probe",
    checkedAt: now,
    contentWrites: 0,
    accounting: {
      before: { freeCredits: { remaining: 3441 }, balance: { amountUsd: 2 } },
      probeReservedCredits: 1,
    },
    liveValidation: {
      requestSent: true,
      authorValidated: true,
      returnedCount: 1,
      snapshotIds: ["sd_PHASE342TEST"],
    },
    preview: [{ authorHandle: "itzyofficial" }],
    executionContext: {
      runId: "12345",
      eventName: "workflow_dispatch",
      ref: "refs/heads/main",
      workflowRef:
        "owner/repo/.github/workflows/brightdata-tiktok.yml@refs/heads/main",
    },
  };
  const after = {
    snapshotId: "sd_PHASE342TEST",
    freeCreditsRemaining: 3440,
    balanceUsd: 2,
    cashSpendUsd: 0,
    autoRecharge: false,
    observedAt: "2026-10-19T02:00:00Z",
    billingStatus: "confirmed",
    evidenceRef: "CONTROLLED",
  };
  assert.equal(
    reconcileProbe(probe, after, {
      expectedRunId: "12345",
      defaultBranch: "main",
    }).accounting.billingVerified,
    true,
  );
  assert.throws(
    () =>
      reconcileProbe(probe, after, {
        expectedRunId: "54321",
        defaultBranch: "main",
      }),
    /PROBE_RUN_PROVENANCE_MISMATCH/,
  );
  assert.throws(
    () =>
      reconcileProbe(
        {
          ...probe,
          executionContext: {
            ...probe.executionContext,
            ref: "refs/pull/3/merge",
          },
        },
        after,
        { expectedRunId: "12345", defaultBranch: "main" },
      ),
    /PROBE_RUN_PROVENANCE_MISMATCH/,
  );
});
