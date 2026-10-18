import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  parseSocialAccounts,
  parseSocialSnapshot,
  isInstant,
  canonicalAccount,
  socialIdentity,
  socialAvailability,
} from "../data/schemas/social.schema.ts";
import { selectSocialContent } from "../src/utils/social-library.ts";
import { parseSyncStatus } from "../data/schemas/sync-status.schema.ts";
import {
  loadSocialAccounts,
  importReviewed,
  validateSocial,
} from "../scripts/social-sync/index.mjs";
const time = "2026-10-17T14:00:00.000Z";
const accounts = await loadSocialAccounts();
const instagram = JSON.parse(
  await readFile(
    new URL("../data/social/instagram/items.json", import.meta.url),
    "utf8",
  ),
);
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "seoul-social-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "social"));
  await writeFile(
    join(root, "social/accounts.json"),
    await readFile(resolve("data/social/accounts.json")),
  );
  for (const platform of ["instagram", "tiktok"]) {
    await mkdir(join(root, `social/${platform}`));
    await writeFile(
      join(root, `social/${platform}/items.json`),
      JSON.stringify({ schemaVersion: 1, platform, items: [] }),
    );
  }
  return root;
}
const candidate = {
  artistId: "twice",
  platform: "instagram",
  sourceUrl: "https://www.instagram.com/reel/FixtureONLY/",
  confirmedAccountUrl: "https://www.instagram.com/twicetagram/",
  evidenceUrl: "https://www.instagram.com/reel/FixtureONLY/embed/",
  evidenceNote: "TEST FIXTURE ONLY; never publish",
};
test("source accessibility, embed restrictions and manual verification remain independent for old and new records", () => {
  const item = instagram.items[0];
  for (const legacy of ["available", "unknown", "restricted"]) {
    const old = {
      ...item,
      availabilityStatus: legacy,
      sourceAvailability: undefined,
      embedAvailability: undefined,
    };
    assert.equal(socialAvailability(old).source, "unknown");
    assert.equal(
      socialAvailability(old).embed,
      legacy === "restricted" ? "restricted" : "untested",
    );
    assert.ok(
      parseSocialSnapshot(
        { ...instagram, items: [old] },
        "instagram",
        accounts,
      ),
    );
  }
  assert.equal(
    socialAvailability({ ...item, availabilityStatus: "deleted" }).source,
    "unavailable",
  );
  const checked = {
    ...item,
    availabilityStatus: "restricted",
    sourceAvailability: "available",
    embedAvailability: "restricted",
  };
  assert.deepEqual(socialAvailability(checked), {
    source: "available",
    embed: "restricted",
  });
  for (const patch of [
    { sourceAvailability: "pending" },
    { embedAvailability: "unknown" },
    { sourceAvailability: null },
    { availabilityStatus: "deleted", sourceAvailability: "available" },
  ])
    assert.equal(
      parseSocialSnapshot(
        { ...instagram, items: [{ ...item, ...patch }] },
        "instagram",
        accounts,
      ),
      null,
    );
});
test("manual import defaults to unknown, accepts separate review and preserves it through legacy reimport", async (t) => {
  const root = await fixture(t),
    options = { root, accounts, reviewer: "test", now: time };
  const file = join(root, "social/instagram/items.json");
  await importReviewed([candidate], options);
  let item = JSON.parse(await readFile(file, "utf8")).items[0];
  assert.deepEqual(socialAvailability(item), {
    source: "unknown",
    embed: "untested",
  });
  await importReviewed(
    [
      {
        ...candidate,
        sourceAvailability: "available",
        embedAvailability: "failed",
      },
    ],
    options,
  );
  await importReviewed([candidate], options);
  item = JSON.parse(await readFile(file, "utf8")).items[0];
  assert.deepEqual(socialAvailability(item), {
    source: "available",
    embed: "failed",
  });
  await assert.rejects(
    importReviewed([{ ...candidate, sourceAvailability: "pending" }], options),
    /Invalid/,
  );
});
test("registry covers enabled Instagram roster with official evidence; spoofed and malformed accounts fail closed", () => {
  assert.equal(accounts.filter((a) => a.platform === "instagram").length, 14);
  const artists = new Set(accounts.map((a) => a.artistId));
  assert.ok(parseSocialAccounts({ schemaVersion: 1, accounts }, artists));
  assert.equal(
    parseSocialAccounts(
      {
        schemaVersion: 1,
        accounts: [
          {
            ...accounts[0],
            accountUrl: "https://www.instagram.com.evil.example/twicetagram/",
          },
        ],
      },
      artists,
    ),
    null,
  );
  assert.equal(
    parseSocialAccounts(
      { schemaVersion: 1, accounts: [{ ...accounts[0], evidenceNote: {} }] },
      artists,
    ),
    null,
  );
  assert.equal(
    canonicalAccount("instagram", "https://www.instagram.com:444/twicetagram/"),
    null,
  );
});
test("social schema keeps unknown dates and rejects wrong platforms, forged embed, author mismatch, duplicates and invalid times", () => {
  assert.ok(parseSocialSnapshot(instagram, "instagram", accounts));
  assert.equal(instagram.items[0].publishedAt, null);
  const check = (patch) =>
    parseSocialSnapshot(
      { ...instagram, items: [{ ...instagram.items[0], ...patch }] },
      "instagram",
      accounts,
    );
  for (const patch of [
    { sourceUrl: "https://evil.example/reel/FixtureONLY/" },
    { embedUrl: "javascript:alert(1)" },
    { officialAccountUrl: "https://www.instagram.com/not_the_artist/" },
    { acquisitionMethod: "api" },
    { publishedAt: "2026-10-17" },
    { publishedAt: "2026-02-30T00:00:00Z" },
    { evidenceNote: {} },
    { reviewedBy: "" },
    { thumbnail: "https://arbitrary.example/image.jpg" },
  ])
    assert.equal(check(patch), null);
  assert.equal(
    parseSocialSnapshot(
      { ...instagram, items: [instagram.items[0], instagram.items[0]] },
      "instagram",
      accounts,
    ),
    null,
  );
  assert.equal(parseSocialSnapshot(instagram, "tiktok", accounts), null);
  assert.equal(isInstant("2026-10-17T10:00:00+09:00"), true);
  assert.equal(isInstant("2026-10-17T24:00:00Z"), false);
});
test("reviewed import requires author assertion, evidence and reviewer; invalid batch changes no files", async (t) => {
  const root = await fixture(t),
    file = join(root, "social/instagram/items.json"),
    before = await readFile(file, "utf8");
  await assert.rejects(
    importReviewed([candidate], { root, accounts, now: time }),
    /reviewer/,
  );
  await assert.rejects(
    importReviewed(
      [
        {
          ...candidate,
          confirmedAccountUrl: "https://www.instagram.com/forged/",
        },
      ],
      { root, accounts, reviewer: "test", now: time },
    ),
    /author/,
  );
  await assert.rejects(
    importReviewed(
      [
        candidate,
        {
          ...candidate,
          sourceUrl: "https://www.instagram.com/reel/OtherFixture/",
          evidenceNote: "",
        },
      ],
      { root, accounts, reviewer: "test", now: time },
    ),
    /evidence/,
  );
  assert.equal(await readFile(file, "utf8"), before);
});
test("manual import deduplicates across runs, preserves unknown dates, and does not count validation as new content", async (t) => {
  const root = await fixture(t),
    options = { root, accounts, reviewer: "test", now: time };
  await importReviewed([candidate], options);
  const next = "2026-10-17T15:00:00.000Z";
  await importReviewed([candidate], { ...options, now: next });
  const snapshot = JSON.parse(
    await readFile(join(root, "social/instagram/items.json"), "utf8"),
  );
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].publishedAt, null);
  assert.equal(snapshot.items[0].fetchedAt, time);
  let status = JSON.parse(
    await readFile(join(root, "status/instagram.json"), "utf8"),
  ).sources[0];
  assert.equal(status.lastContentChangeAt, time);
  assert.equal(status.newCount, 0);
  assert.equal(status.updatedCount, 0);
  assert.equal(status.lastSuccessAt, next);
  assert.equal(status.mode, "manual-validation");
  assert.deepEqual(
    await validateSocial({ root, now: "2026-10-17T16:00:00.000Z" }),
    [],
  );
  status = JSON.parse(
    await readFile(join(root, "status/tiktok.json"), "utf8"),
  ).sources;
  assert.equal(status.length, 14);
  assert.ok(status.every((s) => s.status === "ok" && s.itemCount === 0));
});
test("TikTok importer rejects account forgery and can publish reviewed canonical videos without inventing metadata", async (t) => {
  const root = await fixture(t);
  const item = {
    ...candidate,
    platform: "tiktok",
    sourceUrl:
      "https://www.tiktok.com/@twice_tiktok_official/video/1234567890123456789",
    confirmedAccountUrl: "https://www.tiktok.com/@twice_tiktok_official/",
  };
  await importReviewed([item], {
    root,
    accounts,
    reviewer: "test fixture",
    now: time,
  });
  const snapshot = JSON.parse(
    await readFile(join(root, "social/tiktok/items.json"), "utf8"),
  );
  assert.equal(
    snapshot.items[0].embedUrl,
    "https://www.tiktok.com/player/v1/1234567890123456789",
  );
  assert.equal(snapshot.items[0].title, null);
  assert.equal(snapshot.items[0].availabilityStatus, "unknown");
  await assert.rejects(
    importReviewed(
      [
        {
          ...item,
          sourceUrl: item.sourceUrl.replace(
            "twice_tiktok_official",
            "some_fan",
          ),
        },
      ],
      { root, accounts, reviewer: "test fixture", now: time },
    ),
    /Invalid/,
  );
});
test("local source failure isolates platforms and retains success history; malformed status fails closed", async (t) => {
  const root = await fixture(t);
  await validateSocial({ root, now: time });
  await writeFile(join(root, "social/tiktok/items.json"), "{bad json");
  assert.deepEqual(
    await validateSocial({ root, now: "2026-10-17T15:00:00Z" }),
    ["tiktok"],
  );
  const failed = JSON.parse(
    await readFile(join(root, "status/tiktok.json"), "utf8"),
  );
  assert.ok(
    failed.sources.every(
      (s) =>
        s.status === "failed" &&
        s.lastSuccessAt === time &&
        s.failedSources.length === 1,
    ),
  );
  const healthy = JSON.parse(
    await readFile(join(root, "status/instagram.json"), "utf8"),
  );
  assert.ok(healthy.sources.every((s) => s.status === "ok"));
  assert.ok(parseSyncStatus(failed));
  assert.equal(
    parseSyncStatus({
      ...failed,
      sources: [{ ...failed.sources[0], failedSources: [null] }],
    }),
    null,
  );
});

test("real permalink identity rejects profiles, forged hosts, credentials, queries and non-video TikTok links", () => {
  assert.equal(
    socialIdentity("instagram", "https://www.instagram.com/reel/DegKEZyhoe4/")
      .id,
    "ig-DegKEZyhoe4",
  );
  assert.equal(
    socialIdentity("instagram", "https://www.instagram.com/p/CNfZNyLLFQC/")
      .kind,
    "p",
  );
  assert.equal(
    socialIdentity(
      "tiktok",
      "https://www.tiktok.com/@niziu_official/video/7685715214506954000",
    ).embedUrl,
    "https://www.tiktok.com/player/v1/7685715214506954000",
  );
  for (const [p, u] of [
    ["instagram", "https://www.instagram.com/twicetagram/"],
    ["instagram", "https://www.instagram.com.evil.example/reel/DegKEZyhoe4/"],
    ["instagram", "https://user@www.instagram.com/reel/DegKEZyhoe4/"],
    ["instagram", "http://www.instagram.com/reel/DegKEZyhoe4/"],
    ["tiktok", "https://www.tiktok.com/@niziu_official"],
    [
      "tiktok",
      "https://www.tiktok.com/@niziu_official/photo/7685715214506954000",
    ],
    [
      "tiktok",
      "https://www.tiktok.com/@niziu_official/video/7685715214506954000?spoof=yes",
    ],
  ])
    assert.equal(socialIdentity(p, u), null, u);
});
test("batch duplicates, examples and unconfirmed video posts cannot write any platform", async (t) => {
  const root = await fixture(t),
    options = { root, accounts, reviewer: "test", now: time };
  const files = ["instagram", "tiktok"].map((p) =>
    join(root, `social/${p}/items.json`),
  );
  const before = await Promise.all(files.map((f) => readFile(f, "utf8")));
  await assert.rejects(
    importReviewed([candidate, candidate], options),
    /Duplicate/,
  );
  await assert.rejects(
    importReviewed([{ ...candidate, exampleOnly: true }], options),
    /Example-only/,
  );
  const post = {
    ...candidate,
    sourceUrl: "https://www.instagram.com/p/VideoFixtureONLY/",
    contentType: "video-post",
  };
  await assert.rejects(
    importReviewed([candidate, post], options),
    /video confirmation/,
  );
  await assert.rejects(
    importReviewed([{ ...candidate, contentType: "post" }], options),
    /Content type/,
  );
  assert.deepEqual(
    await Promise.all(files.map((f) => readFile(f, "utf8"))),
    before,
  );
  await importReviewed([{ ...post, confirmedVideo: true }], options);
  const snapshot = JSON.parse(await readFile(files[0], "utf8"));
  assert.equal(snapshot.items[0].contentType, "video-post");
  assert.ok(parseSocialSnapshot(snapshot, "instagram", accounts));
});
test("library separates photos from videos, filters artist and keeps unknown dates stable after known dates", () => {
  const items = [
    { ...instagram.items[0], id: "unknown-a", publishedAt: null },
    {
      ...instagram.items[0],
      id: "photo",
      contentType: "post",
      publishedAt: "2026-10-17T11:00:00Z",
    },
    {
      ...instagram.items[0],
      id: "known",
      contentType: "video-post",
      publishedAt: "2026-10-17T10:00:00Z",
    },
    { ...instagram.items[0], id: "unknown-b", publishedAt: null },
    { ...instagram.items[0], id: "other", artistId: "itzy" },
  ];
  const options = { artistId: "twice", platform: "instagram" };
  assert.deepEqual(
    selectSocialContent(items, options).map((i) => i.id),
    ["known", "unknown-a", "unknown-b"],
  );
  assert.deepEqual(
    selectSocialContent(items, { ...options, kind: "post" }).map((i) => i.id),
    ["photo"],
  );
  assert.equal(
    selectSocialContent(items, { ...options, search: "TWICE" }).length,
    3,
  );
  assert.equal(
    selectSocialContent(items, { ...options, search: "no matches" }).length,
    0,
  );
  assert.equal(items[0].id, "unknown-a");
});
test("production manifests contain only schema-valid distinct reviewed sources and no example placeholders", async () => {
  for (const platform of ["instagram", "tiktok"]) {
    const snapshot = JSON.parse(
      await readFile(resolve(`data/social/${platform}/items.json`), "utf8"),
    );
    assert.ok(parseSocialSnapshot(snapshot, platform, accounts));
    assert.equal(
      new Set(snapshot.items.map((i) => i.id)).size,
      snapshot.items.length,
    );
    for (const i of snapshot.items) {
      assert.doesNotMatch(
        JSON.stringify(i),
        /FixtureONLY|ACTUAL_SHORTCODE|exampleOnly/,
      );
      assert.ok(
        ["manual-verified", "api", "third-party-api"].includes(
          i.acquisitionMethod,
        ),
      );
      if (i.acquisitionMethod === "manual-verified") {
        assert.equal(i.verificationStatus, "manual-verified");
      }
      if (i.acquisitionMethod === "api") {
        assert.equal(i.verificationStatus, "api-verified");
        assert.ok(i.apiEvidence);
      }
      if (i.acquisitionMethod === "third-party-api") {
        assert.equal(platform, "tiktok");
        assert.equal(i.verificationStatus, "account-matched");
        assert.equal(i.apiEvidence, undefined);
        assert.equal(i.thirdPartyEvidence?.provider, "brightdata-tiktok-posts");
        assert.equal(i.thirdPartyEvidence?.datasetId, "gd_lu702nij2f790tmv9h");
        assert.equal(i.thirdPartyEvidence?.videoId, i.id.slice(3));
        assert.equal(i.thirdPartyEvidence?.rawCreateTime, i.publishedAt);
        assert.equal(i.thirdPartyEvidence?.checkedAt, i.lastValidatedAt);
      }
      if (platform === "tiktok")
        assert.equal(
          socialIdentity(platform, i.sourceUrl).handle,
          accounts
            .find((a) => a.artistId === i.artistId && a.platform === platform)
            .handle.toLowerCase(),
        );
    }
  }
});
