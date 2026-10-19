// Offline routing + controlled responses only. Never calls the provider.
import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  cp,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import { selectLaunch } from "../scripts/brightdata-tiktok/launch.mjs";
import { syncBrightData } from "../scripts/brightdata-tiktok/sync.mjs";
import { initializeBrightDataFixture } from "./helpers/brightdata-fixture.mjs";
import {
  BrightDataError,
  checkPermissionAndBudget,
  reserve,
} from "../scripts/brightdata-tiktok/budget.mjs";

const now = "2026-10-19T00:01:00Z";
const approval = {
  schemaVersion: 1,
  month: "2026-10",
  confirmedAt: "2026-10-19T00:00:00Z",
  expiresAt: "2026-11-01T00:00:00Z",
  accountRef: "CONTROLLED_PHASE341_ONLY",
  accountExclusive: true,
  freeTierEligible: true,
  depositedBalanceUsd: 0,
  autoRecharge: false,
  serverFreeTierHardStop: true,
  paidSpendLimitUsd: 0,
  publicMetadataUseApproved: true,
  permissionEvidenceRef: "SIMULATED PERMISSION",
  billingEvidenceRef: "SIMULATED BALANCE",
  freeCreditsRemaining: 4000,
  baselineReservedRecords: 0,
};
const env = {
  BRIGHT_DATA_API_KEY: "FAKE_PHASE341_NOT_A_SECRET",
  BRIGHTDATA_TIKTOK_ENABLED: "true",
  BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED: "false",
  BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify(approval),
};
const context = {
  event: "schedule",
  ref: "refs/heads/main",
  defaultBranch: "main",
};
const closed = [
  undefined,
  null,
  false,
  true,
  "",
  "false",
  "TRUE",
  "True",
  " true",
  "true ",
];
const protectedFiles = [
  "social/tiktok/items.json",
  "status/brightdata-tiktok.json",
  "usage/brightdata-tiktok.json",
];
const bytes = async (root, paths = protectedFiles) =>
  Promise.all(paths.map((p) => readFile(join(root, p), "utf8")));
async function fixture(t, copy = true) {
  const dir = await mkdtemp(join(tmpdir(), "seoul-phase341-"));
  t.after(async () => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    await rm(dir, { recursive: true, force: true });
  });
  if (copy) {
    await cp(resolve("data"), join(dir, "data"), { recursive: true });
    await initializeBrightDataFixture(join(dir, "data"));
  }
  return dir;
}
const execute = (root, extra = {}) =>
  syncBrightData({
    root,
    mode: "probe",
    artist: "itzy",
    limit: 1,
    env,
    clock: () => now,
    ...extra,
  });
const row = JSON.parse(
  await readFile("docs/phase-3.4/sd_mvdx30v5inbop8r5r.json", "utf8"),
).find((r) => r.account_id === "itzyofficial" && !r.error_code);
const response = (body) => new Response(JSON.stringify(body));
function network(state = "ready", beforePost = () => {}) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, options) => {
      calls.push({ url, method: options.method });
      if (options.method === "POST") {
        beforePost(JSON.parse(options.body));
        return response({ snapshot_id: "sd_PHASE341CONTROL" });
      }
      if (url.includes("/progress/"))
        return response({
          snapshot_id: "sd_PHASE341CONTROL",
          dataset_id: "gd_lu702nij2f790tmv9h",
          status: state,
        });
      return response([row]);
    },
  };
}

test("schedule and manual sync require literal true; plan/probe are separate and live modes require default branch", () => {
  for (const value of closed) {
    for (const event of ["schedule", "workflow_dispatch"]) {
      const r = selectLaunch({
        ...context,
        event,
        requestedMode: "sync",
        scheduleEnabled: value,
      });
      assert.equal(r.execute, false);
      assert.equal(r.reason, "SCHEDULE_NOT_ENABLED");
    }
  }
  assert.equal(
    selectLaunch({ ...context, scheduleEnabled: "true" }).execute,
    true,
  );
  for (const mode of [undefined, "plan", "probe"]) {
    const r = selectLaunch({
      ...context,
      event: "workflow_dispatch",
      requestedMode: mode,
    });
    assert.equal(r.execute, true);
    assert.equal(r.mode, mode ?? "plan");
  }
  for (const ref of [
    "refs/heads/feat/brightdata-tiktok",
    "refs/pull/3/merge",
    "refs/tags/main",
  ])
    for (const mode of ["probe", "sync"])
      assert.equal(
        selectLaunch({
          ...context,
          event: "workflow_dispatch",
          ref,
          requestedMode: mode,
          scheduleEnabled: "true",
        }).reason,
        "DEFAULT_BRANCH_REQUIRED",
      );
  for (const event of [
    "pull_request",
    "pull_request_target",
    "push",
    "label",
    undefined,
  ])
    assert.equal(
      selectLaunch({ ...context, event, scheduleEnabled: "true" }).execute,
      false,
    );
  assert.equal(
    selectLaunch({
      ...context,
      defaultBranch: undefined,
      scheduleEnabled: "true",
    }).execute,
    false,
  );
  assert.equal(
    selectLaunch({
      ...context,
      event: "workflow_dispatch",
      requestedMode: "other",
    }).execute,
    false,
  );
});

test("disabled sync preserves all public bytes and budget; not even data reads, locks or remote-budget callbacks are needed", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data"),
    before = await bytes(root);
  for (const flag of closed) {
    let touched = 0;
    const forbidden = async () => {
      touched++;
      throw Error("MUST NOT TOUCH");
    };
    const result = await execute(root, {
      mode: "sync",
      artist: "all",
      limit: 8,
      env: { ...env, BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED: flag },
      fetcher: forbidden,
      budgetStore: { load: forbidden, save: forbidden },
      persistBudget: forbidden,
    });
    assert.equal(result.executionStatus, "disabled");
    assert.equal(result.reason, "SCHEDULE_NOT_ENABLED");
    assert.equal(result.connected, false);
    assert.equal(result.requests, 0);
    assert.equal(result.contentWrites, 0);
    assert.equal(result.liveValidation.requestSent, false);
    assert.equal(touched, 0);
    assert.deepEqual(await bytes(root), before);
    assert.ok(
      !(await readdir(join(root, "usage"))).some((p) => p.endsWith(".lock")),
    );
  }
  const missingRoot = join(dir, "DOES_NOT_EXIST");
  assert.equal(
    (await execute(missingRoot, { mode: "sync" })).executionStatus,
    "disabled",
  );
});

test("actual launch CLI writes an explicit disabled artifact and no data, without provider secrets", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data"),
    before = await bytes(root);
  const outputs = join(dir, "github-output"),
    summary = join(dir, "github-summary");
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/brightdata-tiktok/launch.mjs")],
    {
      cwd: dir,
      encoding: "utf8",
      env: {
        GITHUB_EVENT_NAME: "schedule",
        GITHUB_REF: "refs/heads/main",
        BRIGHTDATA_DEFAULT_BRANCH: "main",
        GITHUB_OUTPUT: outputs,
        GITHUB_STEP_SUMMARY: summary,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const artifact = JSON.parse(
    await readFile(join(dir, "test-results/brightdata-summary.json"), "utf8"),
  );
  assert.equal(artifact.executionStatus, "disabled");
  assert.equal(artifact.requests, 0);
  assert.equal(artifact.liveValidation.billingVerified, false);
  assert.match(artifact.message, /定时采集尚未启用/);
  assert.match(await readFile(outputs, "utf8"), /execute=false\nmode=sync\n/);
  assert.match(await readFile(summary, "utf8"), /不代表真实 API 成功/);
  assert.deepEqual(await bytes(root), before);
});

test("core CLI also stops a disabled sync before live credential/context checks or data mutation", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data"),
    before = await bytes(root);
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/brightdata-tiktok/sync.mjs"), "--mode=sync"],
    {
      cwd: dir,
      encoding: "utf8",
      env: {
        BRIGHT_DATA_API_KEY: "FAKE_CLI_ONLY",
        BRIGHTDATA_TIKTOK_ENABLED: "true",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).executionStatus, "disabled");
  assert.deepEqual(await bytes(root), before);
});

test("manual probe works with schedule off, reserves exactly one ITZY row first, and cannot publish or confirm a bill", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data"),
    before = await bytes(root, protectedFiles.slice(0, 2));
  const saves = [];
  const net = network("ready", (body) => {
    assert.equal(saves[0].reservations[0].limit, 1);
    assert.equal(saves[0].reservations[0].state, "reserved");
    assert.equal(body.input.length, 1);
    assert.equal(body.input[0].url, "https://www.tiktok.com/@itzyofficial/");
    assert.equal(body.limit_per_input, 1);
  });
  const r = await execute(root, {
    fetcher: net.fetcher,
    budgetStore: {
      load: async (seed) => structuredClone(seed),
      save: async (ledger) => {
        saves.push(structuredClone(ledger));
      },
    },
  });
  assert.equal(net.calls.filter((c) => c.method === "POST").length, 1);
  assert.equal(r.preview.length, 1);
  assert.equal(r.preview[0].authorHandle, "itzyofficial");
  assert.equal(r.liveValidation.returnedCount, 1);
  assert.equal(r.liveValidation.authorValidated, true);
  assert.equal(r.liveValidation.newestPublishedAt, row.create_time);
  assert.equal(r.liveValidation.billingVerified, false);
  assert.equal(r.budget.paidSpendUsd, null);
  assert.equal(r.contentWrites, 0);
  assert.deepEqual(await bytes(root, protectedFiles.slice(0, 2)), before);
  assert.equal(saves.at(-1).reservations[0].state, "complete");
  for (const extra of [{ artist: "all" }, { artist: "twice" }, { limit: 8 }])
    await assert.rejects(
      () =>
        execute(root, {
          ...extra,
          fetcher: () => {
            throw Error("MUST NOT REQUEST");
          },
        }),
      /INVALID_BRIGHTDATA_OPTIONS/,
    );
});

test("missing key, permission, expired approval and zero budget block manual probe with zero HTTP or ledger writes", async (t) => {
  const variants = [
    {},
    { ...env, BRIGHTDATA_TIKTOK_ENABLED: "false" },
    { ...env, BRIGHTDATA_ZERO_COST_APPROVAL_JSON: "" },
    {
      ...env,
      BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify({
        ...approval,
        expiresAt: now,
      }),
    },
    {
      ...env,
      BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify({
        ...approval,
        freeCreditsRemaining: 0,
      }),
    },
  ];
  for (const config of variants) {
    const dir = await fixture(t),
      root = join(dir, "data"),
      before = await bytes(root);
    let touched = 0;
    const r = await execute(root, {
      env: config,
      fetcher: () => {
        touched++;
        throw Error("MUST NOT REQUEST");
      },
      persistBudget: () => {
        touched++;
      },
    });
    assert.equal(r.requests, 0);
    assert.equal(r.connected, false);
    assert.equal(touched, 0);
    assert.deepEqual(await bytes(root), before);
  }
});

test("failed shared-budget reservation prevents a probe POST and never resets the pending reservation", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data");
  let calls = 0;
  const r = await execute(root, {
    fetcher: () => {
      calls++;
    },
    budgetStore: {
      load: async (seed) => structuredClone(seed),
      save: async () => {
        throw new BrightDataError("CENTRAL_BUDGET_PERSIST_OR_CONFLICT");
      },
    },
  });
  assert.equal(calls, 0);
  assert.equal(r.requests, 0);
  assert.equal(r.sources[0].error, "CENTRAL_BUDGET_PERSIST_OR_CONFLICT");
  const ledger = JSON.parse(
    await readFile(join(root, "usage/brightdata-tiktok.json"), "utf8"),
  );
  assert.equal(ledger.reservations[0].state, "reserved");
  assert.equal(ledger.reservations[0].limit, 1);
});

test("unknown Snapshot state stops probe, preserves public records and blocks a second POST", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data"),
    before = await bytes(root, protectedFiles.slice(0, 2));
  const net = network("unknown-provider-state");
  const r = await execute(root, { fetcher: net.fetcher, maxPolls: 1 });
  assert.equal(r.sources[0].error, "BRIGHTDATA_UNKNOWN_JOB_STATE");
  assert.equal(r.contentWrites, 0);
  assert.equal(r.liveValidation.resultDownloaded, false);
  assert.equal(net.calls.filter((c) => c.method === "POST").length, 1);
  assert.deepEqual(await bytes(root, protectedFiles.slice(0, 2)), before);
  const second = network();
  const blocked = await execute(root, { fetcher: second.fetcher });
  assert.equal(second.calls.length, 0);
  assert.equal(blocked.sources[0].error, "UNRESOLVED_PROVIDER_JOB");
});

test("workflow removes all PR live triggers, gates secret-bearing steps and publication, and keeps default plan", async () => {
  const workflow = await readFile(
    ".github/workflows/brightdata-tiktok.yml",
    "utf8",
  );
  assert.doesNotMatch(workflow, /pull_request|labeled|brightdata-probe/);
  assert.match(workflow, /default: plan/);
  assert.match(workflow, /cron: "0 0,12 \* \* \*"/);
  const gate = workflow.slice(
    workflow.indexOf("id: launch"),
    workflow.indexOf("- run: npm ci"),
  );
  assert.match(gate, /vars.BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED/);
  assert.doesNotMatch(gate, /secrets\./);
  const collect = workflow.slice(
    workflow.indexOf("id: collect"),
    workflow.indexOf("- name: Upload"),
  );
  assert.match(
    collect,
    /if: steps.launch.outputs.execute == 'true' && steps.launch.outputs.mode != 'plan'/,
  );
  assert.match(collect, /--artist=itzy --limit=1/);
  assert.match(collect, /--persist-git/);
  const publish = workflow.slice(
    workflow.indexOf("id: changes"),
    workflow.indexOf("  deploy:"),
  );
  assert.match(publish, /steps.launch.outputs.execute == 'true'/);
  assert.match(publish, /steps.launch.outputs.mode == 'sync'/);
  assert.match(publish, /github.event.repository.default_branch/);
  assert.match(workflow, /if: needs.sync.outputs.changed == 'true'/);
});

test("offline plan validates six account mappings and local budget without inspecting any credentials or remote state", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data"),
    before = await bytes(root);
  const forbidden = () => {
    throw Error("PLAN MUST NOT ACCESS CREDENTIALS OR NETWORK");
  };
  const result = await execute(root, {
    mode: "plan",
    artist: "all",
    limit: 8,
    env: new Proxy({}, { get: forbidden }),
    fetcher: forbidden,
    budgetStore: { load: forbidden, save: forbidden },
    persistBudget: forbidden,
  });
  assert.equal(result.executionStatus, "offline-plan");
  assert.deepEqual(result.configuration.artistIds, [
    "twice",
    "stray-kids",
    "nmixx",
    "nexz",
    "itzy",
    "niziu",
  ]);
  assert.equal(result.configuration.perAccountLimit, 8);
  assert.equal(result.configuration.schedule, "0 0,12 * * *");
  assert.equal(result.sources.length, 6);
  assert.ok(
    result.sources.every(
      (s) => s.state === "planned" && s.request.body.limit_per_input === 8,
    ),
  );
  assert.equal(result.budget.requestedRecords, 48);
  assert.equal(result.budget.remainingInternalRecords, 4000);
  assert.equal(result.budget.providerFreeCreditsRemaining, null);
  assert.equal(result.budget.authoritative, false);
  assert.equal(result.liveReadiness.apiSecret, "not-inspected");
  assert.equal(result.liveReadiness.zeroCostEvidence, "not-inspected");
  assert.equal(result.liveReadiness.canSendRequests, false);
  assert.equal(result.requests, 0);
  assert.equal(result.connected, false);
  assert.deepEqual(await bytes(root), before);
});

test("offline plan reports pending local tasks without resolving them or modifying budget history", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data");
  const ledger = {
    schemaVersion: 1,
    accountFingerprint: null,
    reservations: [],
  };
  const p = checkPermissionAndBudget(env, ledger, now, 1);
  const pending = reserve(
    ledger,
    { artistId: "itzy" },
    "probe:2026-10-19",
    1,
    now,
    p.fingerprint,
  );
  pending.snapshotId = "sd_PHASE341PENDING";
  await writeFile(
    join(root, "usage/brightdata-tiktok.json"),
    JSON.stringify(ledger),
  );
  const before = await bytes(root);
  const r = await execute(root, {
    mode: "plan",
    env: {},
    fetcher: () => {
      throw Error("MUST NOT REQUEST");
    },
  });
  assert.equal(r.sources[0].error, "UNRESOLVED_PROVIDER_JOB");
  assert.equal(r.budget.unresolvedTaskCount, 1);
  assert.equal(r.budget.reservedRecords, 1);
  assert.equal(r.budget.source, "local-mirror");
  assert.deepEqual(await bytes(root), before);
});

test("offline plan reports exhausted internal budget without assuming provider free credit or resetting reservations", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data");
  const ledger = {
    schemaVersion: 1,
    accountFingerprint: null,
    reservations: [],
  };
  const p = checkPermissionAndBudget(env, ledger, now, 8);
  for (let i = 0; i < 500; i++) {
    const r = reserve(
      ledger,
      { artistId: "itzy" },
      `offline-limit-${i}`,
      8,
      now,
      p.fingerprint,
    );
    Object.assign(r, {
      state: "complete",
      snapshotId: "sd_PHASE341BUDGET",
      recordCount: 0,
      completedAt: now,
    });
  }
  await writeFile(
    join(root, "usage/brightdata-tiktok.json"),
    JSON.stringify(ledger),
  );
  const before = await bytes(root);
  const r = await execute(root, {
    mode: "plan",
    artist: "all",
    limit: 8,
    env: {},
  });
  assert.equal(r.budget.reservedRecords, 4000);
  assert.equal(r.budget.remainingInternalRecords, 0);
  assert.equal(r.budget.providerFreeCreditsRemaining, null);
  assert.ok(r.sources.every((s) => s.error === "FREE_RECORD_BUDGET_EXHAUSTED"));
  assert.equal(r.requests, 0);
  assert.deepEqual(await bytes(root), before);
});

test("reported 3441 free credits never override unknown or deposited 2 USD balance; missing hard stop also blocks", async (t) => {
  // These values reproduce the user's stated numbers as engineering fixtures,
  // not verified billing, account eligibility or permission evidence.
  for (const patch of [
    { depositedBalanceUsd: null },
    { depositedBalanceUsd: 2 },
    { serverFreeTierHardStop: false },
    { autoRecharge: null },
  ]) {
    const dir = await fixture(t),
      root = join(dir, "data"),
      before = await bytes(root);
    const result = await execute(root, {
      env: {
        ...env,
        BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify({
          ...approval,
          freeCreditsRemaining: 3441,
          ...patch,
        }),
      },
      fetcher: () => {
        throw Error("MUST NOT REQUEST");
      },
    });
    assert.equal(result.requests, 0);
    assert.equal(
      result.sources[0].error,
      "ZERO_COST_OR_USE_PERMISSION_UNCONFIRMED",
    );
    assert.deepEqual(await bytes(root), before);
  }
  const permission = checkPermissionAndBudget(
    {
      ...env,
      BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify({
        ...approval,
        freeCreditsRemaining: 3441,
      }),
    },
    { schemaVersion: 1, accountFingerprint: null, reservations: [] },
    now,
    48,
  );
  assert.equal(permission.remaining, 3441);
});

test("actual offline plan CLI needs no API key and returns local-only readiness without writes", async (t) => {
  const dir = await fixture(t),
    root = join(dir, "data"),
    before = await bytes(root);
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/brightdata-tiktok/sync.mjs"), "--mode=plan"],
    { cwd: dir, encoding: "utf8", env: {} },
  );
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.sources.length, 6);
  assert.equal(report.requests, 0);
  assert.equal(report.liveReadiness.apiSecret, "not-inspected");
  assert.equal(report.budget.authoritative, false);
  assert.deepEqual(await bytes(root), before);
});
