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
} from "../data/schemas/social.schema.ts";
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
