// Offline engineering fixtures; live mixed-row evidence is recorded separately.
import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { syncBrightData } from "../scripts/brightdata-tiktok/sync.mjs";
import { normalizeCollectedRows } from "../scripts/brightdata-tiktok/adapter.mjs";
import { loadSocialAccounts } from "../scripts/social-sync/index.mjs";
import { initializeBrightDataFixture } from "./helpers/brightdata-fixture.mjs";
const accounts = await loadSocialAccounts();
const account = accounts.find(
  (a) => a.platform === "tiktok" && a.artistId === "stray-kids",
);
const now = "2026-10-19T12:01:00Z",
  videoId = "7686800836638330222";
const approval = {
  schemaVersion: 1,
  month: "2026-10",
  confirmedAt: "2026-10-19T12:00:00Z",
  expiresAt: "2026-11-01T00:00:00Z",
  accountRef: "PARTIAL_RECORDS_FIXTURE",
  accountExclusive: true,
  freeTierEligible: true,
  depositedBalanceUsd: 0,
  autoRecharge: false,
  serverFreeTierHardStop: true,
  paidSpendLimitUsd: 0,
  publicMetadataUseApproved: true,
  permissionEvidenceRef: "OFFLINE FIXTURE ONLY",
  billingEvidenceRef: "OFFLINE FIXTURE ONLY",
  freeCreditsRemaining: 4000,
  baselineReservedRecords: 0,
};
const env = {
  BRIGHT_DATA_API_KEY: "OFFLINE_FIXTURE_ONLY",
  BRIGHTDATA_TIKTOK_ENABLED: "true",
  BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED: "true",
  BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify(approval),
};
const good = () => ({
  post_id: videoId,
  url: `https://www.tiktok.com/@jypestraykids/video/${videoId}`,
  account_id: account.handle,
  profile_username: "Stray Kids",
  profile_url: account.accountUrl,
  post_type: "video",
  create_time: "2026-10-19T10:00:00Z",
  discovery_input: { url: account.accountUrl },
});
const bad = () => ({
  error: "OFFLINE wait timeout",
  error_code: "wait_element_timeout",
  input: {
    url: "https://www.tiktok.com/@jypestraykids/video/7686800836638330999",
  },
  timestamp: now,
});
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "seoul-partial-"));
  t.after(async () => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    await rm(dir, { recursive: true, force: true });
  });
  const root = join(dir, "data");
  await cp(resolve("data"), root, { recursive: true });
  await initializeBrightDataFixture(root);
  return root;
}
const read = async (root, path) =>
  JSON.parse(await readFile(join(root, path), "utf8"));
function network(rows) {
  const posts = [];
  const fetcher = async (url, options) => {
    const json = (x) => new Response(JSON.stringify(x));
    if (options.method === "POST") {
      const handle = JSON.parse(options.body)
        .input[0].url.split("/@")[1]
        .replace(/\/$/, "");
      posts.push(handle);
      return json({ snapshot_id: `sd_PARTIAL${posts.length}` });
    }
    const id = new URL(url).pathname.split("/").at(-1);
    if (url.includes("/progress/"))
      return json({
        snapshot_id: id,
        dataset_id: "gd_lu702nij2f790tmv9h",
        status: "ready",
      });
    return json(
      posts[Number(id.replace("sd_PARTIAL", "")) - 1] === account.handle
        ? rows
        : [],
    );
  };
  return { fetcher, posts };
}
const execute = (root, net) =>
  syncBrightData({
    root,
    mode: "sync",
    artist: "all",
    clock: () => now,
    env,
    fetcher: net.fetcher,
    sleep: async () => {},
  });
test("ready result with one provider error imports only validated video and still checks all six accounts", async (t) => {
  const root = await fixture(t),
    before = await read(root, "social/tiktok/items.json"),
    net = network([bad(), good()]);
  const report = await execute(root, net),
    s = report.sources.find((s) => s.artistId === "stray-kids");
  assert.equal(net.posts.length, 6);
  assert.equal(new Set(net.posts).size, 6);
  assert.equal(s.state, "failed");
  assert.equal(s.error, "BRIGHTDATA_PARTIAL_RESULT");
  assert.equal(s.newCount, 1);
  assert.equal(s.returnedCount, 2);
  assert.equal(s.lastSuccessAt, now);
  assert.ok(
    report.sources
      .filter((s) => s.artistId !== "stray-kids")
      .every((s) => s.state === "ok"),
  );
  assert.equal(report.failedRecords[0].code, "PROVIDER_WAIT_ELEMENT_TIMEOUT");
  const after = await read(root, "social/tiktok/items.json");
  assert.equal(after.items.length, before.items.length + 1);
  for (const old of before.items)
    assert.deepEqual(
      after.items.find((i) => i.id === old.id),
      old,
    );
  assert.equal(
    after.items.find((i) => i.id === `tt-${videoId}`).officialAccountUrl,
    account.accountUrl,
  );
  assert.ok(!after.items.some((i) => i.id === "tt-7686800836638330999"));
  assert.equal(report.budget.reservedRecords, 48);
  assert.equal(report.budget.deliveredRecords, 2);
  const ledger = await read(root, "usage/brightdata-tiktok.json");
  assert.ok(ledger.reservations.every((r) => r.state === "complete"));
});
test("all-error source retains old data and success time while later accounts still run", async (t) => {
  const root = await fixture(t),
    before = await readFile(join(root, "social/tiktok/items.json"), "utf8"),
    net = network([bad()]);
  const report = await execute(root, net),
    s = report.sources.find((s) => s.artistId === "stray-kids");
  assert.equal(net.posts.length, 6);
  assert.equal(s.state, "failed");
  assert.equal(s.error, "BRIGHTDATA_RECORD_ERROR");
  assert.equal(s.lastSuccessAt, null);
  assert.equal(s.newCount, 0);
  assert.equal(report.contentWrites, 0);
  assert.equal(
    await readFile(join(root, "social/tiktok/items.json"), "utf8"),
    before,
  );
  assert.equal(report.budget.reservedRecords, 48);
  assert.equal(report.budget.deliveredRecords, 1);
});
test("provider-error filtering cannot hide a foreign author or bypass the global safety stop", async (t) => {
  const root = await fixture(t),
    before = await readFile(join(root, "social/tiktok/items.json"), "utf8"),
    net = network([bad(), { ...good(), account_id: "unverified-fan" }]);
  const report = await execute(root, net);
  assert.equal(net.posts.length, 2);
  assert.equal(report.sources[1].error, "BRIGHTDATA_AUTHOR_MISMATCH");
  assert.ok(
    report.sources
      .slice(2)
      .every((s) => s.error === "STOPPED_AFTER_PROVIDER_FAILURE"),
  );
  assert.equal(report.contentWrites, 0);
  assert.equal(
    await readFile(join(root, "social/tiktok/items.json"), "utf8"),
    before,
  );
});
test("error rows count against the provider cap and strict missing identity validation remains", () => {
  const options = { snapshotId: "sd_PARTIALFIXTURE", now, limit: 8 };
  assert.throws(
    () =>
      normalizeCollectedRows(Array.from({ length: 9 }, bad), account, options),
    /BRIGHTDATA_RESULT_LIMIT_OR_FORMAT/,
  );
  assert.throws(
    () => normalizeCollectedRows([bad(), {}], account, options),
    /BRIGHTDATA_INVALID_VIDEO_ID/,
  );
  assert.throws(
    () => normalizeCollectedRows([null], account, options),
    /BRIGHTDATA_RECORD_ERROR/,
  );
});
