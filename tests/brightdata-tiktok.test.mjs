// Controlled engineering responses; NOT a live Bright Data connection.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { syncBrightData } from "../scripts/brightdata-tiktok/sync.mjs";
import {
  collectProfile,
  normalizeRows,
  mergeBrightData,
  triggerRequest,
} from "../scripts/brightdata-tiktok/adapter.mjs";
import {
  checkPermissionAndBudget,
  reserve,
  parseLedger,
  checkSlot,
} from "../scripts/brightdata-tiktok/budget.mjs";
import { loadSocialAccounts } from "../scripts/social-sync/index.mjs";
import {
  parseBrightDataStatus,
  brightDataOverdue,
  BRIGHTDATA_DATASET,
} from "../data/schemas/brightdata.schema.ts";
import { parseSocialSnapshot } from "../data/schemas/social.schema.ts";
import { mergeDiscovered } from "../scripts/social-sync/discover.mjs";
import { expireApiMetadata } from "../scripts/social-sync/retention.mjs";
import { pushSyncChanges } from "../scripts/push-sync-changes.mjs";
const accounts = await loadSocialAccounts(),
  account = accounts.find(
    (a) => a.platform === "tiktok" && a.artistId === "itzy",
  );
const now = "2026-10-18T00:01:00.000Z",
  later = "2026-10-18T00:02:00.000Z";
const dataset = BRIGHTDATA_DATASET,
  id = "7686800836638330121";
const approval = {
  schemaVersion: 1,
  month: "2026-10",
  confirmedAt: "2026-10-18T00:00:00Z",
  expiresAt: "2026-11-01T00:00:00Z",
  accountRef: "ISOLATED_TEST_FREE_ACCOUNT",
  accountExclusive: true,
  freeTierEligible: true,
  depositedBalanceUsd: 0,
  autoRecharge: false,
  serverFreeTierHardStop: true,
  paidSpendLimitUsd: 0,
  publicMetadataUseApproved: true,
  permissionEvidenceRef: "TEST ONLY - NOT A REAL APPROVAL",
  billingEvidenceRef: "TEST ONLY",
  freeCreditsRemaining: 4000,
  baselineReservedRecords: 0,
};
const env = (patch = {}) => ({
  BRIGHTDATA_API_TOKEN: "PRIVATE_FIXTURE_TOKEN",
  BRIGHTDATA_TIKTOK_ENABLED: "true",
  BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify({ ...approval, ...patch }),
});
const row = (patch = {}) => ({
  post_id: id,
  url: `https://www.tiktok.com/@itzyofficial/video/${id}`,
  profile_username: "itzyofficial",
  profile_url: account.accountUrl,
  post_type: "video",
  create_time: "2026-10-17T12:00:00+08:00",
  discovery_input: { url: account.accountUrl },
  ...patch,
});
const json = (d, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { "content-type": "application/json" },
  });
const normalized = (rows = [row()]) =>
  normalizeRows(rows, account, { snapshotId: "sd_FIXTURE123", now, limit: 8 });
const ledger = () => ({
  schemaVersion: 1,
  accountFingerprint: null,
  reservations: [],
});
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "seoul-brightdata-"));
  t.after(async () => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    await rm(dir, { recursive: true, force: true });
  });
  await cp(resolve("data"), join(dir, "data"), { recursive: true });
  return join(dir, "data");
}
function network(rows = [row()], hook = async () => {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    const u = new URL(url);
    calls.push({ url: u.href, options });
    await hook(u, options);
    if (u.pathname.endsWith("/trigger"))
      return json({ snapshot_id: "sd_FIXTURE123" });
    if (u.pathname.includes("/progress/"))
      return json({
        snapshot_id: "sd_FIXTURE123",
        dataset_id: dataset,
        status: "ready",
      });
    if (u.pathname.includes("/snapshot/")) return json(rows);
    throw Error("Unexpected provider call");
  };
  return { calls, fetcher };
}
const read = async (root, path) =>
  JSON.parse(await readFile(join(root, path), "utf8"));
const execute = (root, extra = {}) =>
  syncBrightData({
    root,
    env: env(),
    mode: "sync",
    artist: "itzy",
    clock: () => now,
    ...extra,
  });

test("verified contract: real dataset, profile discovery, server-side caps, no media download", () => {
  const r = triggerRequest(account, 8),
    u = new URL(r.url);
  assert.equal(u.origin, "https://api.brightdata.com");
  assert.equal(u.searchParams.get("dataset_id"), dataset);
  assert.equal(u.searchParams.get("discover_by"), "profile_url");
  assert.equal(u.searchParams.get("type"), "discover_new");
  assert.equal(u.searchParams.get("limit_multiple_results"), "8");
  assert.equal(r.body.limit_per_input, 8);
  assert.equal(r.body.input[0].num_of_posts, 8);
  assert.equal(r.body.input[0].include_pinned_post, false);
  assert.throws(() => triggerRequest(account, 9));
});
test("no token: blocked live probe, zero requests, no changes to existing content/status/ledger", async (t) => {
  const root = await fixture(t),
    before = await read(root, "social/tiktok/items.json");
  let requests = 0;
  const r = await execute(root, {
    env: {},
    mode: "probe",
    limit: 1,
    fetcher: async () => {
      requests++;
      throw Error("MUST NOT CALL");
    },
  });
  assert.equal(requests, 0);
  assert.equal(r.requests, 0);
  assert.equal(r.connected, false);
  assert.equal(r.sources[0].error, "BRIGHTDATA_TOKEN_MISSING");
  assert.deepEqual(await read(root, "social/tiktok/items.json"), before);
  assert.deepEqual(await read(root, "usage/brightdata-tiktok.json"), ledger());
  assert.ok(
    (await read(root, "status/brightdata-tiktok.json")).sources.every(
      (s) => s.lastAttemptAt === null,
    ),
  );
});
test("offline plan never sends requests or mutates even with valid credentials", async (t) => {
  const root = await fixture(t),
    net = network();
  const before = await read(root, "status/brightdata-tiktok.json");
  const r = await execute(root, { mode: "plan", fetcher: net.fetcher });
  assert.equal(r.connected, false);
  assert.equal(net.calls.length, 0);
  assert.equal(r.sources[0].state, "planned");
  assert.deepEqual(await read(root, "status/brightdata-tiktok.json"), before);
});
test("every unknown/paid/shared/expired/unlicensed condition fails closed", () => {
  for (const patch of [
    { depositedBalanceUsd: 1 },
    { autoRecharge: true },
    { accountExclusive: false },
    { serverFreeTierHardStop: false },
    { publicMetadataUseApproved: false },
    { permissionEvidenceRef: "" },
    { billingEvidenceRef: "" },
    { freeTierEligible: false },
    { paidSpendLimitUsd: 1 },
    { month: "2026-09" },
    { expiresAt: now },
    { confirmedAt: "2026-10-19T00:00:00Z" },
    { freeCreditsRemaining: 63 },
    { baselineReservedRecords: 1 },
  ])
    assert.throws(() =>
      checkPermissionAndBudget(env(patch), ledger(), now, 64),
    );
  assert.throws(() =>
    checkPermissionAndBudget(
      { ...env(), BRIGHTDATA_ZERO_COST_APPROVAL_JSON: "invalid" },
      ledger(),
      now,
      1,
    ),
  );
  assert.throws(() =>
    checkPermissionAndBudget(
      { ...env(), BRIGHTDATA_TIKTOK_ENABLED: "false" },
      ledger(),
      now,
      1,
    ),
  );
});
test("provider ID precision, author links, timezone and video type validation rejects malformed rows", () => {
  const items = normalized();
  assert.equal(items[0].id, `tt-${id}`);
  assert.equal(items[0].publishedAt, row().create_time);
  assert.equal(items[0].embedUrl, `https://www.tiktok.com/player/v1/${id}`);
  assert.equal(items[0].sourceAvailability, "unknown");
  assert.equal(items[0].embedAvailability, "untested");
  assert.ok(
    parseSocialSnapshot(
      { schemaVersion: 1, platform: "tiktok", items },
      "tiktok",
      accounts,
    ),
  );
  for (const patch of [
    { post_id: Number(id) },
    { post_id: "123" },
    { profile_username: "fan_itzy" },
    { profile_url: "https://www.tiktok.com/@fan/" },
    { url: `https://www.tiktok.com/@fan/video/${id}` },
    { url: `https://www.tiktok.com.evil.test/@itzyofficial/video/${id}` },
    { create_time: "1970-01-20T00:00:00Z" },
    { create_time: "2026-10-17" },
    { create_time: "2026-11-01T00:00:00Z" },
    { post_type: "image" },
    { post_type: undefined },
    { error: "PRIVATE_PROVIDER_MESSAGE" },
    { discovery_input: { url: "https://www.tiktok.com/@fan/" } },
  ])
    assert.throws(() => normalized([row(patch)]));
  const tracked = normalized([row({ url: row().url + "?lang=ko" })])[0];
  assert.equal(tracked.sourceUrl, row().url);
  assert.equal(tracked.thirdPartyEvidence.originalUrl, row().url + "?lang=ko");
  assert.equal(normalized([row(), row()]).length, 1);
  assert.throws(() =>
    normalized([row(), row({ create_time: "2026-10-16T00:00:00Z" })]),
  );
});
test("durable reservation precedes POST, success time and zero-new check update independently", async (t) => {
  const root = await fixture(t);
  let writes = 0;
  const net = network([row()], async (u) => {
    if (u.pathname.endsWith("/trigger")) {
      assert.ok(writes >= 1);
      const l = await read(root, "usage/brightdata-tiktok.json");
      assert.equal(l.reservations.at(-1).state, "reserved");
      assert.equal(l.reservations.at(-1).limit, 8);
    }
  });
  const r = await execute(root, {
    fetcher: net.fetcher,
    persistBudget: async () => {
      writes++;
    },
  });
  assert.equal(r.connected, true);
  assert.equal(r.requests, 3);
  assert.equal(r.sources[0].newCount, 1);
  assert.equal(r.budget.reservedRecords, 8);
  assert.equal(r.budget.deliveredRecords, 1);
  assert.equal(r.budget.paidSpendUsd, null);
  const file = await read(root, "social/tiktok/items.json");
  assert.equal(
    file.items.find((i) => i.id === `tt-${id}`).acquisitionMethod,
    "third-party-api",
  );
  const second = await execute(root, {
    clock: () => "2026-10-18T12:02:00.000Z",
    fetcher: net.fetcher,
  });
  assert.equal(second.sources[0].newCount, 0);
  assert.equal(second.sources[0].updatedCount, 0);
  assert.equal(second.sources[0].lastSuccessAt, "2026-10-18T12:02:00.000Z");
  assert.equal(second.sources[0].lastContentChangeAt, now);
  const repeat = await execute(root, {
    clock: () => "2026-10-18T12:03:00.000Z",
    fetcher: async () => {
      throw Error("NO REPEAT");
    },
  });
  assert.equal(repeat.requests, 0);
  assert.equal(repeat.sources[0].state, "skipped");
  assert.equal(repeat.budget.reservedRecords, 16);
});
test("failed reservation persistence prevents POST; unresolved reservation blocks future attempts", async (t) => {
  const root = await fixture(t);
  let requests = 0;
  const r = await execute(root, {
    persistBudget: async () => {
      throw Error("PUSH FAILED - PRIVATE");
    },
    fetcher: async () => {
      requests++;
    },
  });
  assert.equal(requests, 0);
  assert.equal(r.connected, false);
  assert.equal(r.budget.reservedRecords, 8);
  const again = await execute(root, { clock: () => later });
  assert.equal(again.sources[0].error, "UNRESOLVED_PROVIDER_JOB");
  assert.equal(again.requests, 0);
});
test("POST is never retried after timeout; stop all remaining accounts; preserve content and budget", async (t) => {
  const root = await fixture(t),
    before = await read(root, "social/tiktok/items.json");
  let calls = 0;
  const r = await execute(root, {
    artist: "all",
    fetcher: async () => {
      calls++;
      throw Error("PRIVATE_TOKEN_OR_PROVIDER_ERROR");
    },
  });
  assert.equal(calls, 1);
  assert.equal(r.sources.length, 8);
  assert.ok(
    r.sources
      .slice(1)
      .every((s) => s.error === "STOPPED_AFTER_PROVIDER_FAILURE"),
  );
  assert.deepEqual(await read(root, "social/tiktok/items.json"), before);
  assert.equal(r.budget.reservedRecords, 8);
  assert.ok(!JSON.stringify(r).includes("PRIVATE_TOKEN"));
});
test("ready snapshot with wrong author or invalid dates never changes data or success time", async (t) => {
  const root = await fixture(t),
    before = await read(root, "social/tiktok/items.json");
  const net = network([row({ profile_username: "fan" })]);
  const r = await execute(root, { fetcher: net.fetcher });
  assert.equal(r.sources[0].state, "failed");
  assert.equal(r.sources[0].lastSuccessAt, null);
  assert.equal(r.budget.reservedRecords, 8);
  assert.deepEqual(await read(root, "social/tiktok/items.json"), before);
});
test("probe is restricted to one real ITZY row and never imports; empty result cannot establish quality", async (t) => {
  const root = await fixture(t),
    before = await read(root, "social/tiktok/items.json"),
    net = network();
  const r = await execute(root, {
    mode: "probe",
    limit: 1,
    fetcher: net.fetcher,
  });
  assert.equal(r.connected, true);
  assert.equal(r.preview[0].authorHandle, "itzyofficial");
  assert.deepEqual(await read(root, "social/tiktok/items.json"), before);
  assert.equal(r.budget.reservedRecords, 1);
  await assert.rejects(() => execute(root, { mode: "probe", limit: 8 }));
  await assert.rejects(() =>
    execute(root, { mode: "probe", artist: "twice", limit: 1 }),
  );
  const emptyRoot = await fixture(t);
  const empty = await execute(emptyRoot, {
    mode: "probe",
    limit: 1,
    fetcher: network([]).fetcher,
  });
  assert.equal(empty.connected, false);
  assert.equal(empty.sources[0].error, "BRIGHTDATA_EMPTY_PROBE");
});
test("zero records is a successful scheduled check, not a discovery failure", async (t) => {
  const root = await fixture(t);
  const r = await execute(root, { fetcher: network([]).fetcher });
  assert.equal(r.sources[0].state, "ok");
  assert.equal(r.sources[0].newCount, 0);
  assert.equal(r.sources[0].lastSuccessAt, now);
});
test("HTTP errors and running-job timeout keep pending reservations; no automatic budget refund", async (t) => {
  for (const failure of ["http", "timeout", "identity", "too-many"]) {
    const root = await fixture(t);
    let calls = 0;
    const fetcher = async (url) => {
      calls++;
      if (url.includes("/trigger"))
        return json({ snapshot_id: "sd_FIXTURE123" });
      if (url.includes("/progress/"))
        return failure === "http"
          ? json({ error: "private" }, 402)
          : json({
              snapshot_id:
                failure === "identity" ? "sd_WRONG12345" : "sd_FIXTURE123",
              dataset_id: dataset,
              status: failure === "too-many" ? "ready" : "running",
            });
      return json(Array(9).fill(row()));
    };
    const r = await execute(root, { fetcher, maxPolls: 1 });
    assert.equal(r.connected, false);
    assert.equal(r.sources[0].state, "failed");
    assert.equal(r.budget.reservedRecords, 8);
    assert.ok(calls <= 3);
    assert.equal(
      (await read(root, "usage/brightdata-tiktok.json")).reservations[0].state,
      "reserved",
    );
  }
});
test("strict monthly cap includes old video rereads and never resets a corrupt/missing ledger", async (t) => {
  const l = ledger(),
    p = checkPermissionAndBudget(env(), l, now, 1);
  for (let i = 0; i < 500; i++) {
    let r = reserve(l, account, `slot-${i}`, 8, now, p.fingerprint);
    r.state = "failed";
    r.completedAt = now;
  }
  assert.equal(parseLedger(l).reservations.length, 500);
  assert.throws(() => checkPermissionAndBudget(env(), l, now, 1));
  assert.throws(() => reserve(l, account, "overflow", 1, now, p.fingerprint));
  const root = await fixture(t);
  await writeFile(join(root, "usage/brightdata-tiktok.json"), "corrupt");
  await assert.rejects(() => execute(root));
  await rm(join(root, "usage/brightdata-tiktok.json"));
  await assert.rejects(() => execute(root));
});
test("all eight verified profiles are independently capped at eight; unverified artists cannot be requested", async (t) => {
  const root = await fixture(t),
    sent = [];
  let n = 0,
    last;
  const fetcher = async (url, options) => {
    if (url.includes("/trigger")) {
      const body = JSON.parse(options.body);
      last = accounts.find((a) => a.accountUrl === body.input[0].url);
      assert.ok(last);
      assert.equal(body.limit_per_input, 8);
      assert.equal(body.input[0].num_of_posts, 8);
      sent.push(last.artistId);
      n++;
      return json({ snapshot_id: `sd_ALLFIXTURE${n}` });
    }
    if (url.includes("/progress/"))
      return json({
        snapshot_id: `sd_ALLFIXTURE${n}`,
        dataset_id: dataset,
        status: "ready",
      });
    const video = (BigInt(id) + BigInt(n)).toString();
    return json([
      row({
        post_id: video,
        url: `https://www.tiktok.com/@${last.handle}/video/${video}`,
        profile_username: last.handle,
        profile_url: last.accountUrl,
        discovery_input: { url: last.accountUrl },
      }),
    ]);
  };
  const result = await execute(root, { artist: "all", fetcher });
  assert.equal(sent.length, 8);
  assert.equal(new Set(sent).size, 8);
  assert.ok(result.sources.every((s) => s.state === "ok"));
  assert.equal(result.budget.reservedRecords, 64);
  assert.equal(result.requests, 24);
  await assert.rejects(
    () => execute(root, { artist: "not-verified" }),
    /INVALID_VERIFIED_ACCOUNT_COVERAGE/,
  );
});
test("budget survives calendar rollover, stale approval and account changes without implicit reset", () => {
  const l = ledger(),
    p = checkPermissionAndBudget(env(), l, now, 8);
  const r = reserve(l, account, "one", 8, now, p.fingerprint);
  r.state = "failed";
  r.completedAt = now;
  assert.throws(
    () =>
      checkPermissionAndBudget(
        env({ accountRef: "ANOTHER_ACCOUNT" }),
        l,
        now,
        8,
      ),
    /BUDGET_ACCOUNT_MISMATCH/,
  );
  assert.throws(() =>
    checkPermissionAndBudget(env(), l, "2026-11-01T00:00:00Z", 8),
  );
  const updated = env({
    month: "2026-11",
    confirmedAt: "2026-11-01T00:00:00Z",
    expiresAt: "2026-12-01T00:00:00Z",
  });
  assert.equal(
    checkPermissionAndBudget(updated, l, "2026-11-01T00:01:00Z", 8).used,
    0,
  );
  assert.equal(l.reservations.length, 1);
  r.state = "reserved";
  assert.throws(
    () => checkPermissionAndBudget(updated, l, "2026-11-01T00:01:00Z", 8),
    /UNRESOLVED_PROVIDER_JOB/,
  );
});
test("real Git clones persist budget separately before publishing TikTok metadata", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "seoul-brightdata-git-"));
  t.after(async () => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    await rm(dir, { recursive: true, force: true });
  });
  const origin = join(dir, "origin.git"),
    local = join(dir, "local");
  const git = (cwd, args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  git(dir, ["init", "--bare", "--initial-branch=main", origin]);
  git(dir, ["clone", origin, local]);
  git(local, ["config", "user.name", "Budget Engineering Test"]);
  git(local, ["config", "user.email", "test@example.invalid"]);
  const { mkdir } = await import("node:fs/promises");
  for (const p of ["data/usage", "data/social/tiktok", "data/status"])
    await mkdir(join(local, p), { recursive: true });
  await writeFile(
    join(local, "data/usage/brightdata-tiktok.json"),
    JSON.stringify(ledger()),
  );
  for (const p of [
    "data/social/tiktok/items.json",
    "data/status/brightdata-tiktok.json",
  ])
    await writeFile(join(local, p), "{}");
  git(local, ["add", "."]);
  git(local, ["commit", "-m", "isolated fixture only"]);
  git(local, ["push", "origin", "main"]);
  const l = ledger(),
    p = checkPermissionAndBudget(env(), l, now, 8);
  reserve(l, account, "slot", 8, now, p.fingerprint);
  await writeFile(
    join(local, "data/usage/brightdata-tiktok.json"),
    JSON.stringify(l),
  );
  assert.equal(
    pushSyncChanges({
      scope: "brightdata-budget",
      run: (args) => git(local, args),
    }),
    true,
  );
  const remoteLedger = JSON.parse(
    git(dir, [
      "--git-dir",
      origin,
      "show",
      "main:data/usage/brightdata-tiktok.json",
    ]),
  );
  assert.equal(remoteLedger.reservations[0].state, "reserved");
  assert.equal(
    git(dir, [
      "--git-dir",
      origin,
      "show",
      "main:data/social/tiktok/items.json",
    ]),
    "{}",
  );
  await writeFile(
    join(local, "data/social/tiktok/items.json"),
    '{"fixture":true}',
  );
  assert.equal(
    pushSyncChanges({ scope: "brightdata", run: (args) => git(local, args) }),
    true,
  );
  assert.equal(
    git(dir, [
      "--git-dir",
      origin,
      "show",
      "main:data/social/tiktok/items.json",
    ]),
    '{"fixture":true}',
  );
});
test("concurrent local lock refuses requests; stale lock is not silently deleted", async (t) => {
  const root = await fixture(t),
    file = join(root, "usage/brightdata-tiktok.lock");
  const lock = await open(file, "wx");
  await lock.close();
  await assert.rejects(() => execute(root), /BUDGET_LEDGER_LOCKED/);
});
test("manual and Display API provenance, playback/removal evidence and stable IDs survive third-party enrichment", async () => {
  const file = JSON.parse(
      await readFile("data/social/tiktok/items.json", "utf8"),
    ),
    old = file.items.find((i) => i.artistId === "itzy");
  const incoming = normalized([
    row({ post_id: old.id.slice(3), url: old.sourceUrl }),
  ]);
  const merged = mergeBrightData(file, incoming);
  assert.equal(merged.newCount, 0);
  assert.equal(merged.updatedCount, 0);
  const enriched = merged.snapshot.items.find((i) => i.id === old.id);
  for (const key of Object.keys(old)) assert.deepEqual(enriched[key], old[key]);
  assert.ok(enriched.thirdPartyEvidence);
  assert.ok(parseSocialSnapshot(merged.snapshot, "tiktok", accounts));
  const third = normalized()[0],
    official = {
      ...third,
      acquisitionMethod: "api",
      verificationStatus: "api-verified",
      apiEvidence: {
        provider: "tiktok-display-api",
        mediaId: id,
        accountId: account.handle,
        checkedAt: now,
      },
    };
  delete official.thirdPartyEvidence;
  const upgraded = mergeDiscovered(
    { schemaVersion: 1, platform: "tiktok", items: [third] },
    [official],
    account,
  ).snapshot;
  assert.ok(parseSocialSnapshot(upgraded, "tiktok", accounts));
  assert.equal(upgraded.items[0].apiEvidence.provider, "tiktok-display-api");
  const expired = expireApiMetadata(
    { schemaVersion: 1, platform: "tiktok", items: [third, enriched] },
    "2026-12-01T00:00:00Z",
  ).snapshot;
  assert.equal(expired.items.length, 1);
  assert.equal(expired.items[0].id, old.id);
  assert.equal(expired.items[0].thirdPartyEvidence, undefined);
});
test("public schema rejects forged provider, identity and official-authorization labels", () => {
  const good = normalized()[0];
  for (const patch of [
    { verificationStatus: "api-verified" },
    { acquisitionMethod: "api" },
    {
      thirdPartyEvidence: {
        ...good.thirdPartyEvidence,
        provider: "tiktok-display-api",
      },
    },
    { thirdPartyEvidence: { ...good.thirdPartyEvidence, authorHandle: "fan" } },
  ])
    assert.equal(
      parseSocialSnapshot(
        {
          schemaVersion: 1,
          platform: "tiktok",
          items: [{ ...good, ...patch }],
        },
        "tiktok",
        accounts,
      ),
      null,
    );
});
test("08/20 schedule, fresh success and blocked status are distinct from official API schedule", async () => {
  const status = JSON.parse(
    await readFile("data/status/brightdata-tiktok.json", "utf8"),
  );
  assert.ok(parseBrightDataStatus(status, accounts));
  assert.ok(status.sources.every((s) => s.lastSuccessAt === null));
  assert.equal(status.sources.length, 8);
  assert.equal(
    brightDataOverdue(
      {
        ...status.sources[0],
        state: "ok",
        lastSuccessAt: "2026-10-18T00:05:00Z",
      },
      Date.parse("2026-10-18T12:30:00Z"),
    ),
    false,
  );
  assert.equal(
    brightDataOverdue(
      {
        ...status.sources[0],
        state: "ok",
        lastSuccessAt: "2026-10-18T00:05:00Z",
      },
      Date.parse("2026-10-18T13:01:00Z"),
    ),
    true,
  );
  assert.equal(
    checkSlot("2026-10-18T04:00:00Z", "sync"),
    "2026-10-18T00:00:00.000Z",
  );
  const workflow = await readFile(
    ".github/workflows/brightdata-tiktok.yml",
    "utf8",
  );
  assert.match(workflow, /cron: "0 0,12 \* \* \*"/);
  assert.match(workflow, /group: social-manifests/);
  assert.match(workflow, /mode=plan/);
  assert.match(workflow, /--persist-git/);
  // Works in the shallow PR checkout as well as a local branch: no assumption
  // that origin/main was fetched. Full protected-file equality is checked in
  // the delivery diff; these assertions protect the actual schedule contract.
  for (const f of ["youtube-sync.yml", "social-sync.yml"])
    assert.match(
      await readFile(`.github/workflows/${f}`, "utf8"),
      /cron: ["']0 0,4,12 \* \* \*["']/,
    );
  assert.match(
    await readFile(".github/workflows/calendar-sync.yml", "utf8"),
    /cron: ["']15 0,12 \* \* \*["']/,
  );
});
