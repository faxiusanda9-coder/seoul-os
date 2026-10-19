import test from "node:test";
import assert from "node:assert/strict";
import { collectProfile } from "../scripts/brightdata-tiktok/adapter.mjs";
import { loadSocialAccounts } from "../scripts/social-sync/index.mjs";
const account = (await loadSocialAccounts()).find(
  (a) => a.platform === "tiktok" && a.artistId === "itzy",
);
const dataset = "gd_lu702nij2f790tmv9h",
  id = "sd_TRANSIENTFIXTURE";
const json = (x) => new Response(JSON.stringify(x));
function network(states, { wrongIdentity = false } = {}) {
  let n = 0;
  const calls = [];
  return {
    calls,
    fetcher: async (url, o) => {
      calls.push({ url, method: o.method });
      if (o.method === "POST") return json({ snapshot_id: id });
      if (url.includes("/progress/"))
        return json({
          snapshot_id: wrongIdentity ? "sd_WRONGFIXTURE" : id,
          dataset_id: dataset,
          status: states[Math.min(n++, states.length - 1)],
        });
      return json([]);
    },
  };
}
test("undocumented transient status is not accepted as ready; only a later matching ready response permits download", async () => {
  const net = network(["undocumented-test-state", "running", "ready"]),
    observed = [];
  const result = await collectProfile(account, {
    token: "FIXTURE_ONLY",
    fetcher: net.fetcher,
    sleep: async () => {},
    maxPolls: 4,
    onUnknownState: async (s) => observed.push(s),
  });
  assert.equal(result.snapshotId, id);
  assert.deepEqual(result.rows, []);
  assert.deepEqual(observed, ["undocumented-test-state"]);
  assert.equal(net.calls.filter((c) => c.method === "POST").length, 1);
  assert.equal(net.calls.filter((c) => c.url.includes("/progress/")).length, 3);
  assert.equal(net.calls.filter((c) => c.url.includes("/snapshot/")).length, 1);
});
test("persistently unknown status has a bounded GET-only grace and never downloads or re-submits", async () => {
  const net = network(["unknown-test-state"]);
  await assert.rejects(
    () =>
      collectProfile(account, {
        token: "FIXTURE_ONLY",
        fetcher: net.fetcher,
        sleep: async () => {},
        maxPolls: 20,
      }),
    /BRIGHTDATA_UNKNOWN_JOB_STATE/,
  );
  assert.equal(net.calls.filter((c) => c.method === "POST").length, 1);
  assert.equal(
    net.calls.filter((c) => c.url.includes("/progress/")).length,
    13,
  );
  assert.equal(net.calls.filter((c) => c.url.includes("/snapshot/")).length, 0);
});
test("wrong snapshot identity stops before grace and cannot download another job", async () => {
  const net = network(["unknown-test-state"], { wrongIdentity: true });
  await assert.rejects(
    () =>
      collectProfile(account, {
        token: "FIXTURE_ONLY",
        fetcher: net.fetcher,
        sleep: async () => {},
        maxPolls: 20,
      }),
    /BRIGHTDATA_SNAPSHOT_IDENTITY_MISMATCH/,
  );
  assert.equal(net.calls.length, 2);
});
