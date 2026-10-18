// Real supplied export + controlled API lifecycle tests. No paid/live API calls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, cp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join, sep } from "node:path";
import { tmpdir } from "node:os";
import { loadSocialAccounts } from "../scripts/social-sync/index.mjs";
import {
  prepareFileImport,
  importSnapshotFile,
} from "../scripts/brightdata-tiktok/import-file.mjs";
import { syncBrightData } from "../scripts/brightdata-tiktok/sync.mjs";
import {
  gitBudgetStore,
  BUDGET_BRANCH,
} from "../scripts/brightdata-tiktok/budget-store.mjs";
import {
  checkPermissionAndBudget,
  reserve,
} from "../scripts/brightdata-tiktok/budget.mjs";
import { parseSocialSnapshot } from "../data/schemas/social.schema.ts";
import { expireApiMetadata } from "../scripts/social-sync/retention.mjs";
import {
  selectAutomaticAccounts,
  TIKTOK_AUTO_ARTISTS,
} from "../data/schemas/brightdata.schema.ts";
const accounts = await loadSocialAccounts(),
  targets = selectAutomaticAccounts(accounts);
const exportRows = JSON.parse(
  await readFile("docs/phase-3.4/sd_mvdx30v5inbop8r5r.json", "utf8"),
);
const now = "2026-10-18T15:00:00Z",
  capture = "2026-10-18T14:55:00Z";
const approval = {
  schemaVersion: 1,
  month: "2026-10",
  confirmedAt: capture,
  expiresAt: "2026-11-01T00:00:00Z",
  accountRef: "CONTROLLED_PHASE34_ONLY",
  accountExclusive: true,
  freeTierEligible: true,
  depositedBalanceUsd: 0,
  autoRecharge: false,
  serverFreeTierHardStop: true,
  paidSpendLimitUsd: 0,
  publicMetadataUseApproved: true,
  permissionEvidenceRef: "TEST ONLY - NO REAL LICENSE",
  billingEvidenceRef: "TEST ONLY - NO REAL BALANCE",
  freeCreditsRemaining: 4000,
  baselineReservedRecords: 0,
};
const env = {
  BRIGHT_DATA_API_KEY: "PRIVATE_PHASE34_ENGINEERING_ONLY",
  BRIGHTDATA_TIKTOK_ENABLED: "true",
  BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED: "true",
  BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify(approval),
};
const ledger = () => ({
  schemaVersion: 1,
  accountFingerprint: null,
  reservations: [],
});
const read = async (root, path) =>
  JSON.parse(await readFile(join(root, path), "utf8"));
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });
const realItzy = exportRows.find(
  (r) => !r.error_code && r.account_id === "itzyofficial",
);
async function fixture(t) {
  const path = await mkdtemp(join(tmpdir(), "seoul-phase34-"));
  t.after(async () => {
    assert.ok(resolve(path).startsWith(resolve(tmpdir()) + sep));
    await rm(path, { recursive: true, force: true });
  });
  await cp(resolve("data"), join(path, "data"), { recursive: true });
  return join(path, "data");
}
function network(rows, states = ["ready"]) {
  let progress = 0;
  const calls = [];
  return {
    calls,
    fetcher: async (url, options) => {
      calls.push({ url, method: options.method });
      if (url.includes("/trigger"))
        return response({ snapshot_id: "sd_PHASE34TEST" });
      if (url.includes("/progress/"))
        return response({
          snapshot_id: "sd_PHASE34TEST",
          dataset_id: "gd_lu702nij2f790tmv9h",
          status: states[Math.min(progress++, states.length - 1)],
        });
      return response(rows);
    },
  };
}
const execute = (root, extra = {}) =>
  syncBrightData({
    root,
    mode: "sync",
    artist: "itzy",
    env,
    clock: () => now,
    ...extra,
  });

test("historical third-party index is not deleted by age; official API retention and explicit deletion stay independent", async () => {
  const snapshot = JSON.parse(
    await readFile("data/social/tiktok/items.json", "utf8"),
  );
  assert.deepEqual(
    expireApiMetadata(snapshot, "2027-10-18T00:00:00Z").snapshot,
    snapshot,
  );
  const original = snapshot.items.find(
    (i) => i.acquisitionMethod === "third-party-api",
  );
  const official = {
    ...original,
    acquisitionMethod: "api",
    verificationStatus: "api-verified",
    apiEvidence: {
      provider: "tiktok-display-api",
      mediaId: original.id.slice(3),
      accountId: original.thirdPartyEvidence.authorHandle,
      checkedAt: original.lastValidatedAt,
    },
  };
  assert.equal(
    expireApiMetadata(
      { ...snapshot, items: [official] },
      "2027-10-18T00:00:00Z",
    ).snapshot.items.length,
    0,
  );
  const removed = {
    ...original,
    availabilityStatus: "deleted",
    sourceAvailability: "unavailable",
  };
  assert.equal(
    expireApiMetadata({ ...snapshot, items: [removed] }, now).snapshot.items[0]
      .availabilityStatus,
    "deleted",
  );
});

test("actual supplied export replays 57/45/12/3; original 35 records and all imported IDs are preserved", async () => {
  const current = JSON.parse(
    await readFile("data/social/tiktok/items.json", "utf8"),
  );
  const audit = JSON.parse(
    await readFile("docs/phase-3.4/pre-integration-audit.json", "utf8"),
  );
  const added = new Set(audit.addedIds);
  const baseline = {
    ...current,
    items: current.items
      .filter((i) => !added.has(i.id))
      .map((i) => {
        const { thirdPartyEvidence, ...old } = i;
        return old;
      }),
  };
  assert.equal(baseline.items.length, 35);
  assert.equal(current.items.length, 80);
  assert.equal(new Set(current.items.map((i) => i.id)).size, 80);
  const result = prepareFileImport(
    exportRows,
    accounts,
    baseline,
    "sd_mvdx30v5inbop8r5r",
  );
  assert.equal(result.report.accepted, 57);
  const totals = Object.values(result.report.accounts).reduce(
    (x, s) => ({
      new: x.new + s.new,
      enriched: x.enriched + s.enriched,
      failed: x.failed + s.failures.length,
    }),
    { new: 0, enriched: 0, failed: 0 },
  );
  assert.deepEqual(totals, { new: 45, enriched: 12, failed: 3 });
  assert.deepEqual(result.manifest, current);
  const hashes = JSON.parse(
    await readFile("docs/phase-3.4/baseline35-hashes.json", "utf8"),
  );
  for (const entry of hashes) {
    const item = current.items.find((i) => i.id === entry.id);
    assert.ok(item);
    const original = Object.fromEntries(entry.keys.map((k) => [k, item[k]]));
    assert.equal(
      createHash("sha256").update(JSON.stringify(original)).digest("hex"),
      entry.sha256,
    );
  }
  assert.ok(!current.items.some((i) => i.id === "tt-7693500342285225237"));
  for (const id of ["tt-7696754928999517461", "tt-7692365601884425492"]) {
    const item = current.items.find((i) => i.id === id);
    assert.equal(item.acquisitionMethod, "manual-verified");
    assert.equal(item.thirdPartyEvidence, undefined);
  }
  for (const id of audit.acceptedIds)
    assert.ok(current.items.some((i) => i.id === id));
  assert.ok(parseSocialSnapshot(current, "tiktok", accounts));
  assert.doesNotMatch(
    JSON.stringify({ current, exportRows }),
    /"(?:video_url|cdn_url|cdn_link|tt_chain_token|Authorization)"/,
  );
  assert.equal(realItzy.account_id, "itzyofficial");
  assert.notEqual(realItzy.profile_username, "itzyofficial");
});
test("only specified six account mappings can run automatically, while historical other artists remain", async (t) => {
  assert.deepEqual(
    targets.map((a) => a.artistId),
    [...TIKTOK_AUTO_ARTISTS],
  );
  assert.equal(targets.length, 6);
  assert.throws(() =>
    selectAutomaticAccounts(accounts.filter((a) => a.artistId !== "itzy")),
  );
  assert.throws(() => selectAutomaticAccounts([...accounts, targets[0]]));
  assert.throws(() =>
    selectAutomaticAccounts(
      accounts.map((a) =>
        a.artistId === "itzy" ? { ...a, verificationStatus: "unverified" } : a,
      ),
    ),
  );
  const root = await fixture(t);
  for (const artist of ["girlset", "boy-story", "not-verified"])
    await assert.rejects(() =>
      execute(root, {
        artist,
        fetcher: () => {
          throw Error("MUST NOT REQUEST");
        },
      }),
    );
  const before = await read(root, "social/tiktok/items.json");
  await execute(root, { env: {}, artist: "all" });
  assert.deepEqual(await read(root, "social/tiktok/items.json"), before);
});
test("no-new successful API checks leave production content bytes untouched while success time advances", async (t) => {
  const root = await fixture(t),
    file = join(root, "social/tiktok/items.json"),
    before = await readFile(file, "utf8");
  const net = network([realItzy, realItzy]);
  const r = await execute(root, { fetcher: net.fetcher });
  assert.equal(r.sources[0].state, "ok");
  assert.equal(r.sources[0].newCount, 0);
  assert.equal(r.sources[0].updatedCount, 0);
  assert.equal(r.contentWrites, 0);
  assert.equal(r.budget.reservedRecords, 8);
  assert.equal(r.budget.deliveredRecords, 2);
  assert.equal(r.budget.paidSpendUsd, null);
  assert.equal(r.sources[0].lastSuccessAt, now);
  assert.equal(await readFile(file, "utf8"), before);
  const later = await execute(root, {
    clock: () => "2026-10-19T00:01:00Z",
    fetcher: network([realItzy]).fetcher,
  });
  assert.equal(later.sources[0].lastSuccessAt, "2026-10-19T00:01:00Z");
  assert.equal(later.contentWrites, 0);
  assert.equal(await readFile(file, "utf8"), before);
});
test("controlled new ID is appended once, leaving every existing object and saved IDs intact", async (t) => {
  const root = await fixture(t),
    before = await read(root, "social/tiktok/items.json");
  const id = "8888888888888888888",
    row = {
      ...realItzy,
      post_id: id,
      url: `https://www.tiktok.com/@itzyofficial/video/${id}`,
    };
  const result = await execute(root, { fetcher: network([row, row]).fetcher });
  assert.equal(result.sources[0].newCount, 1);
  assert.equal(result.contentWrites, 1);
  const after = await read(root, "social/tiktok/items.json");
  assert.equal(after.items.length, 81);
  for (const item of before.items)
    assert.deepEqual(
      after.items.find((i) => i.id === item.id),
      item,
    );
  assert.equal(
    after.items.find((i) => i.id === `tt-${id}`).embedUrl,
    `https://www.tiktok.com/player/v1/${id}`,
  );
});
test("snapshot starting/running is not published before ready; no POST retry and safe failure evidence", async (t) => {
  const root = await fixture(t),
    file = join(root, "social/tiktok/items.json"),
    before = await readFile(file, "utf8");
  const net = network([realItzy], ["starting", "running", "ready"]);
  let sleeps = 0;
  const result = await execute(root, {
    fetcher: net.fetcher,
    sleep: async () => {
      sleeps++;
      assert.equal(await readFile(file, "utf8"), before);
    },
  });
  assert.equal(sleeps, 2);
  assert.equal(net.calls.filter((c) => c.method === "POST").length, 1);
  assert.equal(result.liveValidation.apiReturned, true);
  assert.equal(result.liveValidation.authorValidated, true);
  const failedRoot = await fixture(t),
    bad = exportRows.find(
      (r) => r.error_code && r.discovery_input.url.includes("itzyofficial"),
    );
  const failed = await execute(failedRoot, {
    fetcher: network([realItzy, bad]).fetcher,
  });
  assert.equal(failed.contentWrites, 0);
  assert.equal(failed.sources[0].state, "failed");
  assert.equal(failed.failedRecords[0].code, "PROVIDER_DEAD_PAGE");
  assert.ok(!JSON.stringify(failed).includes("tt_chain_token"));
});
test("new Secret name is mandatory; missing key and insufficient whole-six budget mean zero requests", async (t) => {
  const root = await fixture(t);
  let calls = 0;
  const noKey = await execute(root, {
    env: { BRIGHTDATA_API_TOKEN: "LEGACY_NAME_MUST_NOT_WORK" },
    fetcher: () => {
      calls++;
    },
  });
  assert.equal(noKey.requests, 0);
  assert.equal(calls, 0);
  const limited = await execute(root, {
    artist: "all",
    env: {
      ...env,
      BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify({
        ...approval,
        freeCreditsRemaining: 47,
      }),
    },
    fetcher: () => {
      calls++;
    },
  });
  assert.equal(limited.requests, 0);
  assert.equal(calls, 0);
  assert.ok(
    limited.sources.every((s) => s.error === "FREE_RECORD_BUDGET_EXHAUSTED"),
  );
});
test("real Git shared budget rejects races across two clones and never modifies main", async (t) => {
  const path = await mkdtemp(join(tmpdir(), "seoul-phase34-git-"));
  t.after(async () => {
    assert.ok(resolve(path).startsWith(resolve(tmpdir()) + sep));
    await rm(path, { recursive: true, force: true });
  });
  const git = (cwd, args, input) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      input,
      stdio: ["pipe", "pipe", "pipe"],
    });
  const remote = join(path, "remote.git");
  git(path, ["init", "--bare", "--initial-branch=main", remote]);
  const clones = [];
  for (const name of ["a", "b"]) {
    const cwd = join(path, name);
    git(path, ["clone", remote, cwd]);
    git(cwd, ["config", "user.name", "Phase34 Test"]);
    git(cwd, ["config", "user.email", "fixture@example.invalid"]);
    clones.push(cwd);
  }
  await writeFile(join(clones[0], "site.txt"), "UNCHANGED SITE");
  git(clones[0], ["add", "."]);
  git(clones[0], ["commit", "-m", "isolated site fixture"]);
  git(clones[0], ["push", "origin", "main"]);
  const main = git(path, ["--git-dir", remote, "rev-parse", "main"]).trim();
  await assert.rejects(
    () => gitBudgetStore({ cwd: clones[0] }).load(ledger()),
    /CENTRAL_BUDGET_NOT_INITIALIZED/,
  );
  const a = gitBudgetStore({ cwd: clones[0], allowCreate: true }),
    b = gitBudgetStore({ cwd: clones[1], allowCreate: true });
  const la = await a.load(ledger()),
    lb = await b.load(ledger());
  const permission = checkPermissionAndBudget(env, la, now, 8);
  reserve(
    la,
    targets.find((a) => a.artistId === "itzy"),
    "race-a",
    8,
    now,
    permission.fingerprint,
  );
  reserve(
    lb,
    targets.find((a) => a.artistId === "itzy"),
    "race-b",
    8,
    now,
    permission.fingerprint,
  );
  await a.save(la);
  await assert.rejects(() => b.save(lb), /CENTRAL_BUDGET_PERSIST_OR_CONFLICT/);
  assert.equal(
    git(path, ["--git-dir", remote, "rev-parse", "main"]).trim(),
    main,
  );
  const persisted = JSON.parse(
    git(path, ["--git-dir", remote, "show", `${BUDGET_BRANCH}:ledger.json`]),
  );
  assert.equal(persisted.reservations.length, 1);
  assert.equal(persisted.reservations[0].limit, 8);
  const next = await gitBudgetStore({ cwd: clones[1] }).load(ledger());
  assert.throws(
    () => checkPermissionAndBudget(env, next, now, 8),
    /UNRESOLVED_PROVIDER_JOB/,
  );
});
test("repeat offline file import is idempotent and does not rewrite the manifest", async (t) => {
  const root = await fixture(t),
    file = join(root, "social/tiktok/items.json"),
    before = await readFile(file, "utf8");
  const report = await importSnapshotFile({
    root,
    file: resolve("docs/phase-3.4/sd_mvdx30v5inbop8r5r.json"),
    write: true,
  });
  assert.equal(report.accepted, 57);
  assert.equal(report.wroteManifest, false);
  assert.equal(await readFile(file, "utf8"), before);
});
test("workflow binds required Secret, preserves scheduling and excludes probe branches from deployment", async () => {
  const workflow = await readFile(
    ".github/workflows/brightdata-tiktok.yml",
    "utf8",
  );
  assert.ok(
    workflow.includes(
      "BRIGHT_DATA_API_KEY: ${{ secrets.BRIGHT_DATA_API_KEY }}",
    ),
  );
  assert.ok(!workflow.includes("secrets.BRIGHTDATA_API_TOKEN"));
  assert.match(workflow, /cron: "0 0,12 \* \* \*"/);
  assert.doesNotMatch(workflow, /pull_request|labeled|brightdata-probe/);
  assert.match(workflow, /steps.launch.outputs.mode == 'sync'/);
  assert.match(
    workflow,
    /github.ref == format\('refs\/heads\/\{0\}', github.event.repository.default_branch\)/,
  );
  assert.match(workflow, /uses: .\/.github\/workflows\/deploy.yml/);
  assert.match(workflow, /group: social-manifests/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  const deploy = await readFile(".github/workflows/deploy.yml", "utf8");
  assert.match(deploy, /group: pages/);
  assert.match(deploy, /branches: \[main\]/);
});
