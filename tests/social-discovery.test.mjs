import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  discoverSocial,
  readDiscovery,
  mergeDiscovered,
} from "../scripts/social-sync/discover.mjs";
import {
  discoverInstagram,
  discoverTikTok,
  canonicalMediaUrl,
  instagramItem,
  tiktokItem,
} from "../scripts/social-sync/adapters.mjs";
import { apiRequest } from "../scripts/social-sync/http.mjs";
import {
  tikTokCredentials,
  githubCredentialStore,
} from "../scripts/social-sync/credentials.mjs";
import { expireApiMetadata } from "../scripts/social-sync/retention.mjs";
import { loadSocialAccounts } from "../scripts/social-sync/index.mjs";
import { parseSocialSnapshot } from "../data/schemas/social.schema.ts";
import {
  parseDiscoveryStatus,
  latestDueSlot,
  discoveryIsStale,
} from "../data/schemas/social-discovery.schema.ts";
import { pushSyncChanges } from "../scripts/push-sync-changes.mjs";
const accounts = await loadSocialAccounts();
const ig = accounts.find(
  (a) => a.platform === "instagram" && a.artistId === "twice",
);
const tt = accounts.find(
  (a) => a.platform === "tiktok" && a.artistId === "twice",
);
const now = "2026-10-18T04:10:00Z";
const igEnv = {
  INSTAGRAM_ACCESS_TOKEN: "PRIVATE_IG_TEST_TOKEN",
  INSTAGRAM_IG_USER_ID: "178414000000001",
};
const ttCredential = {
  accessToken: "PRIVATE_TT_TEST_TOKEN",
  openId: "PRIVATE_TEST_OPEN_ID",
  expiresAt: "2026-10-19T04:10:00Z",
  refreshToken: "PRIVATE_TEST_REFRESH",
};
const ttEnv = {
  TIKTOK_CREDENTIALS_JSON: JSON.stringify({ twice: ttCredential }),
};
const options = { now, sleep: async () => {} };
const igMedia = (code = "DiscoveryFIXTURE1", id = "180000000000001") => ({
  id,
  caption: "TEST FIXTURE ONLY — never publish",
  media_type: "VIDEO",
  media_product_type: "REELS",
  permalink: `https://www.instagram.com/reel/${code}/?utm_source=test`,
  timestamp: "2026-10-18T12:00:00+08:00",
});
const ttMedia = (id = "7686800836638330121") => ({
  id,
  title: "TEST FIXTURE ONLY",
  video_description: "Engineering response only",
  create_time: 1792296000,
  share_url: `https://www.tiktok.com/@twice_tiktok_official/video/${id}?utm_source=test`,
});
const response = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const igResponse = (media, paging) =>
  response({
    id: igEnv.INSTAGRAM_IG_USER_ID,
    business_discovery: {
      id: "178414000000002",
      username: "twicetagram",
      media: { data: media, ...(paging ? { paging } : {}) },
    },
  });
const ttResponse = (videos, has_more = false, cursor = 100) =>
  response({ data: { videos, has_more, cursor }, error: { code: "ok" } });
const identity = () =>
  response({
    data: { user: { open_id: ttCredential.openId, username: tt.handle } },
    error: { code: "ok" },
  });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "seoul-discovery-"));
  t.after(async () => {
    const absolute = resolve(root);
    assert.ok(absolute.startsWith(resolve(tmpdir()) + requireSep()));
    await rm(absolute, { recursive: true, force: true });
  });
  await cp(resolve("data"), join(root, "data"), { recursive: true });
  await rm(join(root, "data/status/social-discovery.json"), { force: true });
  return { root, data: join(root, "data") };
}
function requireSep() {
  return process.platform === "win32" ? "\\" : "/";
}

test("no credentials means no requests, no fabricated success; dry-run writes nothing", async (t) => {
  const { data } = await fixture(t);
  const file = join(data, "social/instagram/items.json"),
    before = await readFile(file, "utf8");
  let calls = 0;
  const r = await discoverSocial({
    root: data,
    env: {},
    dryRun: true,
    now,
    fetcher: async () => {
      calls++;
      throw Error("Unexpected network");
    },
  });
  assert.equal(calls, 0);
  assert.equal(r.sources.length, 22);
  assert.ok(
    r.sources.every(
      (s) =>
        s.state === "not-configured" &&
        s.lastSuccessAt === null &&
        s.newCount === null &&
        s.accountVerifiedAt === null,
    ),
  );
  assert.equal((await readDiscovery(data, accounts)).sources.length, 0);
  await discoverSocial({ root: data, env: {}, now });
  assert.equal((await readDiscovery(data, accounts)).sources.length, 22);
  assert.equal(await readFile(file, "utf8"), before);
  const disabled = await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    now,
    dryRun: true,
    env: { ...igEnv, SOCIAL_DISABLED_SOURCES: "instagram:twice" },
    fetcher: async () => {
      calls++;
      throw Error("unexpected request");
    },
  });
  assert.equal(disabled.sources[0].state, "disabled");
  assert.equal(calls, 0);
  assert.equal(disabled.sources[0].lastSuccessAt, null);
});

test("official API normalization preserves long string IDs, dates, raw captions and safe single-content URLs", () => {
  const i = instagramItem(ig, igMedia(), now, "178414000000002");
  assert.equal(i.id, "ig-DiscoveryFIXTURE1");
  assert.equal(i.publishedAt, "2026-10-18T12:00:00+08:00");
  assert.equal(i.embedAvailability, "untested");
  assert.ok(
    parseSocialSnapshot(
      { schemaVersion: 1, platform: "instagram", items: [i] },
      "instagram",
      accounts,
    ),
  );
  assert.equal(
    instagramItem(
      ig,
      { ...igMedia(), caption: "文".repeat(2200) },
      now,
      "178414000000002",
    ).description.length,
    2200,
  );
  const ti = tiktokItem(tt, ttMedia(), now, tt.handle);
  assert.equal(
    tiktokItem(tt, { ...ttMedia(), create_time: null }, now, tt.handle)
      .publishedAt,
    null,
  );
  assert.equal(
    instagramItem(ig, { ...igMedia(), timestamp: null }, now, "178414000000002")
      .publishedAt,
    null,
  );
  assert.equal(ti.id, "tt-7686800836638330121");
  assert.ok(
    parseSocialSnapshot(
      { schemaVersion: 1, platform: "tiktok", items: [ti] },
      "tiktok",
      accounts,
    ),
  );
  assert.throws(() =>
    tiktokItem(tt, { ...ttMedia(), id: Number(ttMedia().id) }, now, tt.handle),
  );
  for (const url of [
    "https://www.instagram.com/twicetagram/",
    "https://www.instagram.com.evil.test/reel/FixtureONLY/",
    "https://user@www.instagram.com/reel/FixtureONLY/",
    "http://www.instagram.com/reel/FixtureONLY/",
  ])
    assert.throws(() => canonicalMediaUrl("instagram", url));
  assert.throws(() =>
    tiktokItem(
      tt,
      {
        ...ttMedia(),
        share_url: ttMedia().share_url.replace(
          "twice_tiktok_official",
          "forged",
        ),
      },
      now,
      tt.handle,
    ),
  );
  assert.throws(() =>
    instagramItem(
      ig,
      { ...igMedia(), timestamp: "2026-10-18" },
      now,
      "178414000000002",
    ),
  );
});

test("Business Discovery uses nested cursors, binds username and rejects repeated/incomplete pages", async () => {
  const seen = [];
  const result = await discoverInstagram(
    ig,
    { accessToken: "PRIVATE", callerId: igEnv.INSTAGRAM_IG_USER_ID },
    {
      ...options,
      fetcher: async (url, init) => {
        seen.push(new URL(url).searchParams.get("fields"));
        assert.equal(init.headers.Authorization, "Bearer PRIVATE");
        assert.equal(new URL(url).searchParams.get("access_token"), null);
        return seen.length === 1
          ? igResponse([igMedia()], {
              cursors: { after: "NEXT_CURSOR" },
              next: "https://evil.test/?access_token=PRIVATE",
            })
          : igResponse([]);
      },
    },
  );
  assert.equal(result.pagesRead, 2);
  assert.match(seen[1], /media\.limit\(25\)\.after\(NEXT_CURSOR\)/);
  await assert.rejects(
    discoverInstagram(
      ig,
      { accessToken: "PRIVATE", callerId: igEnv.INSTAGRAM_IG_USER_ID },
      {
        ...options,
        fetcher: async () =>
          response({
            business_discovery: {
              id: "178414000000002",
              username: "forged",
              media: { data: [] },
            },
          }),
      },
    ),
    /ACCOUNT_IDENTITY/,
  );
  await assert.rejects(
    discoverInstagram(
      ig,
      { accessToken: "PRIVATE", callerId: igEnv.INSTAGRAM_IG_USER_ID },
      {
        ...options,
        fetcher: async () =>
          igResponse([igMedia()], { cursors: { after: "SAME_CURSOR" } }),
      },
    ),
    /REPEATED_CURSOR/,
  );
  await assert.rejects(
    discoverInstagram(
      ig,
      { accessToken: "PRIVATE", callerId: igEnv.INSTAGRAM_IG_USER_ID },
      {
        ...options,
        maxPages: 1,
        fetcher: async () =>
          igResponse([igMedia()], { cursors: { after: "NEXT" } }),
      },
    ),
    /PAGE_LIMIT_INCOMPLETE/,
  );
});

test("TikTok verifies authorized subject and handle before discovery, paginates, and keeps a 48h overlap", async () => {
  let calls = 0;
  const result = await discoverTikTok(tt, ttCredential, {
    ...options,
    fetcher: async (url) => {
      calls++;
      return url.includes("user/info")
        ? identity()
        : calls === 2
          ? ttResponse([ttMedia()], true, 99)
          : ttResponse([ttMedia("7686800836638330122")]);
    },
  });
  assert.equal(result.pagesRead, 2);
  assert.equal(result.items.length, 2);
  assert.ok(!JSON.stringify(result).includes(ttCredential.openId));
  await assert.rejects(
    discoverTikTok(tt, ttCredential, {
      ...options,
      fetcher: async () =>
        response({
          data: { user: { open_id: "WRONG", username: tt.handle } },
          error: { code: "ok" },
        }),
    }),
    /ACCOUNT_IDENTITY/,
  );
  let pages = 0;
  await discoverTikTok(tt, ttCredential, {
    ...options,
    lastSuccessAt: now,
    fetcher: async (url) =>
      url.includes("user/info")
        ? identity()
        : (pages++,
          ttResponse([{ ...ttMedia(), create_time: 1700000000 }], true, 999)),
  });
  assert.equal(pages, 1);
  await assert.rejects(
    discoverTikTok(tt, ttCredential, {
      ...options,
      maxPages: 1,
      fetcher: async (url) =>
        url.includes("user/info")
          ? identity()
          : ttResponse([ttMedia()], true, 99),
    }),
    /PAGE_LIMIT_INCOMPLETE/,
  );
});

test("request errors are sanitized, auth is distinct, retry/backoff bounded and redirects disabled", async () => {
  for (const status of [401, 403])
    await assert.rejects(
      apiRequest(
        "https://graph.facebook.com/v26.0/12345",
        {},
        {
          ...options,
          fetcher: async () => new Response("PRIVATE", { status }),
        },
      ),
      (e) => e.state === "auth-required",
    );
  for (const status of [429, 500]) {
    let calls = 0;
    const waits = [];
    await assert.rejects(
      apiRequest(
        "https://graph.facebook.com/v26.0/12345",
        {},
        {
          fetcher: async () => {
            calls++;
            return response({ error: { message: "PRIVATE" } }, status, {
              "retry-after": "999",
            });
          },
          sleep: async (ms) => waits.push(ms),
        },
      ),
      (e) => !e.message.includes("PRIVATE"),
    );
    assert.equal(calls, 3);
    assert.ok(waits.every((ms) => ms <= 5000));
  }
  await assert.rejects(
    apiRequest(
      "https://graph.facebook.com/v26.0/12345",
      {},
      {
        ...options,
        fetcher: async () =>
          response({ error: { code: 190, message: "SECRET" } }),
      },
    ),
    (e) => e.state === "auth-required" && !e.message.includes("SECRET"),
  );
  await assert.rejects(
    apiRequest(
      "https://open.tiktokapis.com/v2/video/list/",
      {},
      {
        ...options,
        fetcher: async () =>
          response({ error: { code: "scope_not_authorized" } }),
      },
    ),
    (e) => e.state === "auth-required",
  );
  await assert.rejects(
    apiRequest("https://evil.test/", {}, options),
    /INVALID_API_ENDPOINT/,
  );
  await assert.rejects(
    apiRequest(
      "https://graph.facebook.com/v26.0/12345",
      {},
      {
        ...options,
        fetcher: async () => {
          throw Error("NETWORK PRIVATE_TOKEN");
        },
      },
    ),
    (e) => e.code === "NETWORK_OR_TIMEOUT",
  );
  await assert.rejects(
    apiRequest(
      "https://graph.facebook.com/v26.0/12345",
      {},
      { ...options, deadline: 0 },
    ),
    /TIME_BUDGET/,
  );
  await apiRequest(
    "https://graph.facebook.com/v26.0/12345",
    {},
    {
      ...options,
      fetcher: async (_u, init) => {
        assert.equal(init.redirect, "error");
        assert.ok(init.signal);
        return response({});
      },
    },
  );
});

test("discovery merges manual IDs without changing review/playback evidence; repeat run has no content changes", async (t) => {
  const { data } = await fixture(t),
    file = join(data, "social/instagram/items.json");
  const before = JSON.parse(await readFile(file, "utf8"));
  const manual = before.items.find(
    (i) => i.artistId === "itzy" && i.contentType === "reels",
  );
  const account = accounts.find(
    (a) => a.platform === "instagram" && a.artistId === "itzy",
  );
  const incoming = instagramItem(
    account,
    { ...igMedia(), permalink: manual.sourceUrl },
    now,
    "178414000000002",
  );
  const merged = mergeDiscovered(before, [incoming], account);
  assert.equal(merged.snapshot.items.length, before.items.length);
  assert.equal(merged.newCount, 0);
  assert.equal(merged.updatedCount, 0);
  const { apiEvidence, ...kept } = merged.snapshot.items.find(
    (i) => i.id === manual.id,
  );
  assert.deepEqual(kept, manual);
  assert.ok(apiEvidence);
  const first = instagramItem(ig, igMedia(), now, "178414000000002");
  const alias = instagramItem(
    ig,
    igMedia("OtherCodeFIXTURE1"),
    now,
    "178414000000002",
  );
  assert.throws(
    () => mergeDiscovered({ items: [first] }, [alias], ig),
    /CONTENT_IDENTITY/,
  );
  let r = await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: igEnv,
    ...options,
    fetcher: async () => igResponse([igMedia()]),
  });
  assert.equal(r.sources[0].newCount, 1);
  assert.equal(r.sources[0].lastSuccessAt, now);
  r = await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: igEnv,
    ...options,
    now: "2026-10-18T12:10:00Z",
    fetcher: async () => igResponse([igMedia()]),
  });
  assert.equal(r.sources[0].newCount, 0);
  assert.equal(r.sources[0].updatedCount, 0);
  assert.equal(r.sources[0].lastContentChangeAt, now);
  assert.equal(r.sources[0].lastSuccessAt, "2026-10-18T12:10:00Z");
  const content = JSON.parse(await readFile(file, "utf8"));
  assert.equal(
    content.items.filter((i) => i.id === "ig-DiscoveryFIXTURE1").length,
    1,
  );
});

test("account failure is isolated, incomplete pages preserve bytes and prior success is not advanced", async (t) => {
  const { data } = await fixture(t);
  const file = join(data, "social/instagram/items.json");
  await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: igEnv,
    ...options,
    fetcher: async () => igResponse([igMedia()]),
  });
  const before = await readFile(file, "utf8");
  const beforeCount = JSON.parse(before).items.length;
  const r = await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: igEnv,
    ...options,
    now: "2026-10-18T05:10:00Z",
    maxPages: 1,
    fetcher: async () =>
      igResponse([igMedia("IncompleteFIXTURE2", "180000000000002")], {
        cursors: { after: "MORE" },
      }),
  });
  assert.equal(await readFile(file, "utf8"), before);
  assert.equal(r.sources[0].lastSuccessAt, now);
  assert.equal(r.sources[0].state, "failed");
  assert.equal(r.sources[0].newCount, null);
  const both = await discoverSocial({
    root: data,
    platform: "instagram",
    env: igEnv,
    ...options,
    now: "2026-10-18T06:10:00Z",
    fetcher: async (url) => {
      const handle = new URL(url).searchParams
        .get("fields")
        .match(/username\(([^)]+)/)[1];
      return handle === ig.handle
        ? igResponse([])
        : response({ error: { code: 190 } });
    },
  });
  assert.equal(both.sources.find((s) => s.artistId === "twice").state, "ok");
  assert.ok(both.sources.some((s) => s.state === "auth-required"));
  assert.equal(
    JSON.parse(await readFile(file, "utf8")).items.length,
    beforeCount,
  ); // no removal inferred from empty list
});

test("token refresh requires durable storage, binds open_id, and persists rotated credentials before use", async () => {
  const map = { twice: { ...ttCredential, expiresAt: now } };
  let calls = 0,
    persisted = false;
  const env = { TIKTOK_CLIENT_KEY: "key", TIKTOK_CLIENT_SECRET: "secret" };
  const fetcher = async () => {
    calls++;
    return response({
      open_id: ttCredential.openId,
      access_token: "ROTATED_PRIVATE",
      refresh_token: "ROTATED_REFRESH_PRIVATE",
      expires_in: 86400,
      scope: "user.info.basic,user.info.profile,video.list",
    });
  };
  await assert.rejects(
    tikTokCredentials("twice", structuredClone(map), env, {
      ...options,
      fetcher,
    }),
    /RENEWAL_REQUIRED/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    tikTokCredentials("twice", structuredClone(map), env, {
      ...options,
      fetcher,
      dryRun: true,
      persist: async () => {},
    }),
    /RENEWAL_REQUIRED/,
  );
  assert.equal(calls, 0);
  const c = await tikTokCredentials("twice", map, env, {
    ...options,
    fetcher,
    persist: async (m) => {
      assert.equal(m.twice.refreshToken, "ROTATED_REFRESH_PRIVATE");
      persisted = true;
    },
  });
  assert.ok(persisted);
  assert.equal(c.accessToken, "ROTATED_PRIVATE");
  await assert.rejects(
    tikTokCredentials(
      "twice",
      { twice: { ...ttCredential, expiresAt: now } },
      env,
      {
        ...options,
        fetcher,
        persist: async () => {
          throw Error("PRIVATE");
        },
      },
    ),
    /PERSISTENCE_FAILED/,
  );
  assert.equal(
    githubCredentialStore({
      GITHUB_TOKEN: "NOT_ENOUGH",
      GITHUB_REPOSITORY: "owner/repo",
    }),
    null,
  );
});

test("rotated token JSON is encrypted for GitHub Secrets; no plaintext token sent in PUT", async () => {
  const { default: sodium } = await import("libsodium-wrappers");
  await sodium.ready;
  const pair = sodium.crypto_box_keypair();
  let put;
  const persist = githubCredentialStore(
    {
      SOCIAL_SECRET_WRITER_TOKEN: "private_writer",
      GITHUB_REPOSITORY: "owner/repo",
    },
    {
      fetcher: async (url, init) => {
        if (url.endsWith("public-key"))
          return response({
            key: sodium.to_base64(
              pair.publicKey,
              sodium.base64_variants.ORIGINAL,
            ),
            key_id: "test_key",
          });
        put = JSON.parse(init.body);
        return new Response(null, { status: 204 });
      },
    },
  );
  await persist({ twice: ttCredential });
  assert.ok(!JSON.stringify(put).includes(ttCredential.accessToken));
  const decoded = sodium.to_string(
    sodium.crypto_box_seal_open(
      sodium.from_base64(put.encrypted_value, sodium.base64_variants.ORIGINAL),
      pair.publicKey,
      pair.privateKey,
    ),
  );
  assert.equal(JSON.parse(decoded).twice.accessToken, ttCredential.accessToken);
});

test("retention expires API-only metadata and strips expired API proof without deleting manual records", () => {
  const item = instagramItem(
    ig,
    igMedia(),
    "2026-09-01T00:00:00Z",
    "178414000000002",
  );
  const manual = {
    ...item,
    id: "manual-test",
    acquisitionMethod: "manual-verified",
    verificationStatus: "manual-verified",
  };
  const r = expireApiMetadata({ items: [item, manual] }, now);
  assert.equal(r.prunedCount, 2);
  assert.equal(r.snapshot.items.length, 1);
  assert.equal(r.snapshot.items[0].id, "manual-test");
  assert.equal(r.snapshot.items[0].apiEvidence, undefined);
});

test("freshness follows Beijing schedule with grace and the twelve-hour overnight interval", () => {
  assert.equal(
    new Date(latestDueSlot(Date.parse("2026-10-18T00:30:00Z"))).toISOString(),
    "2026-10-17T12:00:00.000Z",
  );
  assert.equal(
    new Date(latestDueSlot(Date.parse("2026-10-18T01:01:00Z"))).toISOString(),
    "2026-10-18T00:00:00.000Z",
  );
  assert.equal(
    new Date(latestDueSlot(Date.parse("2026-10-18T05:01:00Z"))).toISOString(),
    "2026-10-18T04:00:00.000Z",
  );
  assert.equal(
    discoveryIsStale(
      { state: "ok", lastSuccessAt: "2026-10-17T12:20:00Z" },
      Date.parse("2026-10-18T00:30:00Z"),
    ),
    false,
  );
  assert.equal(
    discoveryIsStale(
      { state: "ok", lastSuccessAt: "2026-10-17T12:20:00Z" },
      Date.parse("2026-10-18T01:01:00Z"),
    ),
    true,
  );
});

test("sync push retries non-fast-forward without force and aborts conflicts", () => {
  let pushes = 0;
  const commands = [];
  const run = (args) => {
    commands.push(args);
    if (args[0] === "branch") return "main";
    if (args[0] === "status") return " M data/status/social-discovery.json";
    if (args[0] === "push" && pushes++ === 0) throw Error("race");
    return "";
  };
  assert.equal(pushSyncChanges({ scope: "social", run }), true);
  assert.equal(pushes, 2);
  assert.ok(!JSON.stringify(commands).includes("--force"));
  const conflict = (args) => {
    if (args[0] === "pull") throw Error("conflict");
    return run(args);
  };
  assert.throws(
    () => pushSyncChanges({ scope: "youtube", run: conflict }),
    /conflict/,
  );
  assert.throws(
    () => pushSyncChanges({ scope: "social", run: () => "dev" }),
    /requires main/,
  );
});

test("controlled official response reaches generated JSON and real staging pipeline, never production manifests", async (t) => {
  const { root, data } = await fixture(t);
  await discoverSocial({
    root: data,
    env: igEnv,
    platform: "instagram",
    artist: "twice",
    now: new Date().toISOString(),
    fetcher: async () => igResponse([igMedia()]),
  });
  execFileSync(process.execPath, [resolve("scripts/stage-public-data.mjs")], {
    cwd: root,
    stdio: "pipe",
  });
  const staged = JSON.parse(
    await readFile(
      join(root, "public/data/social/instagram/items.json"),
      "utf8",
    ),
  );
  assert.equal(
    staged.items.find((i) => i.id === "ig-DiscoveryFIXTURE1").acquisitionMethod,
    "api",
  );
  const status = JSON.parse(
    await readFile(
      join(root, "public/data/status/social-discovery.json"),
      "utf8",
    ),
  );
  assert.ok(parseDiscoveryStatus(status, accounts));
  assert.equal(status.sources[0].state, "ok");
  for (const platform of ["instagram", "tiktok"])
    assert.ok(
      !(
        await readFile(resolve(`data/social/${platform}/items.json`), "utf8")
      ).includes("DiscoveryFIXTURE"),
    );
});

test("valid dry-run can discover but cannot write, and actual API metadata changes advance only the content-change clock", async (t) => {
  const { data } = await fixture(t),
    file = join(data, "social/instagram/items.json"),
    before = await readFile(file, "utf8");
  const r = await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: igEnv,
    ...options,
    dryRun: true,
    fetcher: async () => igResponse([igMedia()]),
  });
  assert.equal(r.sources[0].newCount, 1);
  assert.equal(await readFile(file, "utf8"), before);
  assert.equal((await readDiscovery(data, accounts)).sources.length, 0);
  await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: igEnv,
    ...options,
    fetcher: async () => igResponse([igMedia()]),
  });
  const changedAt = "2026-10-18T05:00:00Z";
  const changed = await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: igEnv,
    ...options,
    now: changedAt,
    fetcher: async () =>
      igResponse([{ ...igMedia(), caption: "Changed original caption" }]),
  });
  assert.equal(changed.sources[0].updatedCount, 1);
  assert.equal(changed.sources[0].lastContentChangeAt, changedAt);
  const missing = await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: {},
    ...options,
    now: "2026-10-18T06:00:00Z",
  });
  assert.equal(missing.sources[0].lastSuccessAt, changedAt);
  assert.equal(missing.sources[0].newCount, null);
  const reel = instagramItem(
    ig,
    {
      ...igMedia(),
      permalink: "https://www.instagram.com/p/DiscoveryFIXTURE1/",
    },
    now,
    "178414000000002",
  );
  assert.equal(reel.contentType, "reels");
  assert.ok(
    parseSocialSnapshot(
      { schemaVersion: 1, platform: "instagram", items: [reel] },
      "instagram",
      accounts,
    ),
  );
});

test("real local git writers preserve concurrent independent data and reject conflicting JSON", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "seoul-discovery-git-"));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + requireSep()));
    await rm(root, { recursive: true, force: true });
  });
  const remote = join(root, "remote.git");
  const git = (cwd, args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  git(root, ["init", "--bare", "--initial-branch=main", remote]);
  const clone = (name) => {
    const p = join(root, name);
    git(root, ["clone", remote, p]);
    git(p, ["config", "user.email", "test@example.invalid"]);
    git(p, ["config", "user.name", "Engineering test"]);
    git(p, ["config", "commit.gpgsign", "false"]);
    return p;
  };
  const a = clone("a");
  for (const path of [
    "data/social/instagram/items.json",
    "data/social/tiktok/items.json",
    "data/status/instagram.json",
    "data/status/tiktok.json",
  ]) {
    await mkdir(join(a, path, ".."), { recursive: true });
    await writeFile(join(a, path), "{}\n");
  }
  await mkdir(join(a, "data/status"), { recursive: true });
  await mkdir(join(a, "data/youtube"), { recursive: true });
  await writeFile(
    join(a, "data/status/social-discovery.json"),
    '{"value":"base"}\n',
  );
  await writeFile(join(a, "data/youtube/test.json"), '{"value":"base"}\n');
  git(a, ["add", "data"]);
  git(a, ["commit", "-m", "baseline"]);
  git(a, ["push", "origin", "main"]);
  const b = clone("b");
  await writeFile(
    join(a, "data/status/social-discovery.json"),
    '{"value":"social"}\n',
  );
  let raced = false;
  const run = (args) => {
    if (args[0] === "push" && !raced) {
      raced = true;
      execFileSync(
        process.execPath,
        [
          "-e",
          "require('fs').writeFileSync('data/youtube/test.json',JSON.stringify({value:'youtube'})+'\\n')",
        ],
        { cwd: b, stdio: "pipe" },
      );
      git(b, ["add", "data"]);
      git(b, ["commit", "-m", "concurrent youtube"]);
      git(b, ["push", "origin", "main"]);
    }
    return git(a, args);
  };
  assert.equal(pushSyncChanges({ scope: "social", run }), true);
  assert.equal(
    JSON.parse(await readFile(join(a, "data/youtube/test.json"), "utf8")).value,
    "youtube",
  );
  const c = clone("c"),
    d = clone("d");
  await writeFile(
    join(c, "data/status/social-discovery.json"),
    '{"value":"ours"}\n',
  );
  let conflicted = false;
  assert.throws(
    () =>
      pushSyncChanges({
        scope: "social",
        run: (args) => {
          if (args[0] === "push" && !conflicted) {
            conflicted = true;
            execFileSync(
              process.execPath,
              [
                "-e",
                "require('fs').writeFileSync('data/status/social-discovery.json',JSON.stringify({value:'theirs'})+'\\n')",
              ],
              { cwd: d, stdio: "pipe" },
            );
            git(d, ["add", "data"]);
            git(d, ["commit", "-m", "concurrent social"]);
            git(d, ["push", "origin", "main"]);
          }
          return git(c, args);
        },
      }),
    /conflict/,
  );
  assert.equal(
    JSON.parse(
      git(d, ["show", "origin/main:data/status/social-discovery.json"]),
    ).value,
    "theirs",
  );
});

test("remote success timestamps reflect completion rather than the scheduled/start time", async (t) => {
  const { data } = await fixture(t);
  let clock = now;
  const end = "2026-10-18T04:10:15Z";
  const r = await discoverSocial({
    root: data,
    platform: "instagram",
    artist: "twice",
    env: igEnv,
    now,
    clock: () => clock,
    fetcher: async () => {
      clock = end;
      return igResponse([igMedia()]);
    },
  });
  assert.equal(r.sources[0].lastAttemptAt, now);
  assert.equal(r.sources[0].lastCompletedAt, end);
  assert.equal(r.sources[0].lastSuccessAt, end);
  const snapshot = JSON.parse(
    await readFile(join(data, "social/instagram/items.json"), "utf8"),
  );
  assert.equal(
    snapshot.items.find((i) => i.id === "ig-DiscoveryFIXTURE1").apiEvidence
      .checkedAt,
    end,
  );
});
