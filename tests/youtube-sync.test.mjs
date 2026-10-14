import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncTwice, syncEnabledChannels, expireStaleChannel, loadChannels } from "../scripts/youtube-sync.mjs";
import {
  parseContentSnapshot,
  TWICE_CHANNEL_ID,
  TWICE_UPLOADS_ID,
} from "../data/schemas/content.schema.ts";

const VIDEO_ID = "AbCdEfGh123";
const TIME = "2026-10-14T00:00:00.000Z";
const empty = {
  schemaVersion: 1,
  channelId: TWICE_CHANNEL_ID,
  uploadsPlaylistId: TWICE_UPLOADS_ID,
  fetchedAt: null,
  items: [],
};

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "seoul-os-sync-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dataFile = join(dir, "twice.json");
  await writeFile(dataFile, `${JSON.stringify(empty)}\n`);
  return dataFile;
}

function mockFetch(url) {
  const endpoint = new URL(url).pathname.split("/").at(-1);
  const data =
    endpoint === "channels"
      ? {
          items: [
            {
              id: TWICE_CHANNEL_ID,
              contentDetails: {
                relatedPlaylists: { uploads: TWICE_UPLOADS_ID },
              },
            },
          ],
        }
      : endpoint === "playlistItems"
        ? {
            items: [
              { contentDetails: { videoId: VIDEO_ID } },
              { contentDetails: { videoId: VIDEO_ID } },
            ],
          }
        : {
            items: [
              {
                id: VIDEO_ID,
                snippet: {
                  channelId: TWICE_CHANNEL_ID,
                  title: "TWICE TEST M/V",
                  description: "Test fixture only",
                  publishedAt: TIME,
                  thumbnails: {
                    medium: {
                      url: `https://i.ytimg.com/vi/${VIDEO_ID}/mqdefault.jpg`,
                    },
                  },
                },
                status: { privacyStatus: "public" },
              },
            ],
          };
  return Promise.resolve({ ok: true, json: async () => data });
}

test("valid official uploads produce one canonical content row", async (t) => {
  const dataFile = await fixture(t);
  const result = await syncTwice({
    apiKey: "test-key",
    fetchImpl: mockFetch,
    dataFile,
    now: TIME,
  });
  assert.deepEqual(result, { changed: true, count: 1 });
  const snapshot = parseContentSnapshot(
    JSON.parse(await readFile(dataFile, "utf8")),
  );
  assert.ok(snapshot);
  assert.equal(snapshot.items[0].id, `yt-${VIDEO_ID}`);
  assert.equal(snapshot.items[0].type, "music-video");
  assert.equal(snapshot.items[0].source.channelId, TWICE_CHANNEL_ID);
  assert.equal(snapshot.items[0].source.verification, "official-channel");
});

test("missing key reports error and retains old bytes", async (t) => {
  const dataFile = await fixture(t);
  const before = await readFile(dataFile, "utf8");
  await assert.rejects(
    syncTwice({ apiKey: "", dataFile }),
    /YOUTUBE_API_KEY is missing/,
  );
  assert.equal(await readFile(dataFile, "utf8"), before);
});

test("API failure retains previous successful snapshot", async (t) => {
  const dataFile = await fixture(t);
  await syncTwice({
    apiKey: "test-key",
    fetchImpl: mockFetch,
    dataFile,
    now: TIME,
  });
  const before = await readFile(dataFile, "utf8");
  await assert.rejects(
    syncTwice({
      apiKey: "test-key",
      dataFile,
      now: TIME,
      fetchImpl: async () => ({ ok: false, status: 500 }),
    }),
    /HTTP 500/,
  );
  assert.equal(await readFile(dataFile, "utf8"), before);
});

test("repeat sync is idempotent and does not duplicate uploads", async (t) => {
  const dataFile = await fixture(t);
  await syncTwice({
    apiKey: "test-key",
    fetchImpl: mockFetch,
    dataFile,
    now: TIME,
  });
  const before = await readFile(dataFile, "utf8");
  const next = await syncTwice({
    apiKey: "test-key",
    fetchImpl: mockFetch,
    dataFile,
    now: "2026-10-14T12:00:00.000Z",
  });
  assert.deepEqual(next, { changed: false, count: 1 });
  assert.equal(await readFile(dataFile, "utf8"), before);
});

test("private videos are removed after a successful refresh", async (t) => {
  const dataFile = await fixture(t);
  await syncTwice({ apiKey: "test-key", fetchImpl: mockFetch, dataFile, now: TIME });
  const replacementId = "ZyXwVuTs987";
  const replacementFetch = async (url) => {
    const endpoint = new URL(url).pathname.split("/").at(-1);
    if (endpoint === "playlistItems")
      return { ok: true, json: async () => ({ items: [
        { contentDetails: { videoId: VIDEO_ID } },
        { contentDetails: { videoId: replacementId } },
      ] }) };
    if (endpoint === "videos")
      return { ok: true, json: async () => ({ items: [{
        id: replacementId,
        snippet: {
          channelId: TWICE_CHANNEL_ID,
          title: "TWICE TEST performance",
          description: "Test fixture only",
          publishedAt: TIME,
          thumbnails: { medium: { url: `https://i.ytimg.com/vi/${replacementId}/mqdefault.jpg` } },
        },
        status: { privacyStatus: "public" },
      }, {
        id: VIDEO_ID,
        snippet: {
          channelId: TWICE_CHANNEL_ID,
          title: "Private fixture",
          publishedAt: TIME,
          thumbnails: { medium: { url: `https://i.ytimg.com/vi/${VIDEO_ID}/mqdefault.jpg` } },
        },
        status: { privacyStatus: "private" },
      }] }) };
    return mockFetch(url);
  };
  await syncTwice({ apiKey: "test-key", fetchImpl: replacementFetch, dataFile, now: "2026-10-15T00:00:00.000Z" });
  const snapshot = parseContentSnapshot(JSON.parse(await readFile(dataFile, "utf8")));
  assert.ok(snapshot);
  assert.deepEqual(snapshot.items.map((item) => item.id), [`yt-${replacementId}`]);
});

test("localized video metadata requires an explicit verified flag", async (t) => {
  const dataFile = await fixture(t);
  await syncTwice({
    apiKey: "test-key",
    fetchImpl: mockFetch,
    dataFile,
    now: TIME,
  });
  const snapshot = JSON.parse(await readFile(dataFile, "utf8"));
  snapshot.items[0].localizedTitle = "已核实的测试译名";
  assert.equal(parseContentSnapshot(snapshot), null);
  snapshot.items[0].translationVerified = true;
  assert.ok(parseContentSnapshot(snapshot));
  assert.equal(snapshot.items[0].title, "TWICE TEST M/V");
});

test("enabled channels stay independent when one API request fails", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "seoul-os-multi-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const channels = (await loadChannels()).filter((item) => item.enabled);
  assert.deepEqual(channels.slice(0, 3).map((item) => item.artistId), ["twice", "stray-kids", "itzy"]);
  const ids = new Map(channels.map((item, index) => [item.artistId, `Test${String(index).padStart(7, "0")}`]));
  const fetchFor = (failArtist = "") => async (url) => {
    const parsed = new URL(url);
    const part = parsed.pathname.split("/").at(-1);
    const channel = channels.find((item) => item.channelId === parsed.searchParams.get("id") ||
      item.uploadsPlaylistId === parsed.searchParams.get("playlistId") ||
      ids.get(item.artistId) === parsed.searchParams.get("id"));
    assert.ok(channel);
    if (channel.artistId === failArtist && part === "channels")
      return { ok: false, status: 500 };
    const id = ids.get(channel.artistId);
    const data = part === "channels"
      ? { items: [{ id: channel.channelId, contentDetails: { relatedPlaylists: { uploads: channel.uploadsPlaylistId } } }] }
      : part === "playlistItems"
        ? { items: [{ contentDetails: { videoId: id } }, { contentDetails: { videoId: id } }] }
        : { items: [{ id, snippet: { channelId: channel.channelId, title: `${channel.displayName} TEST M/V`,
          description: "Fixture only", publishedAt: TIME,
          thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } } },
          status: { privacyStatus: "public" } }] };
    return { ok: true, json: async () => data };
  };
  const first = await syncEnabledChannels({ apiKey: "test-key", fetchImpl: fetchFor(), dataDir: dir });
  assert.deepEqual(first.map((item) => item.status), channels.map(() => "success"));
  assert.deepEqual(first.map((item) => item.count), channels.map(() => 1));
  assert.equal(first.reduce((sum, item) => sum + item.requests, 0), 3 * channels.length);
  const strayBefore = await readFile(join(dir, "stray-kids.json"), "utf8");
  const second = await syncEnabledChannels({ apiKey: "test-key", fetchImpl: fetchFor("stray-kids"), dataDir: dir });
  assert.deepEqual(second.map((item) => item.status), channels.map((item) => item.artistId === "stray-kids" ? "failed" : "success"));
  assert.equal(await readFile(join(dir, "stray-kids.json"), "utf8"), strayBefore);
  assert.equal(second[0].changed, false);
  assert.equal(second[2].changed, false);
  assert.equal(second[1].requests, 3);
  const twice = JSON.parse(await readFile(join(dir, "twice.json"), "utf8"));
  const itzy = JSON.parse(await readFile(join(dir, "itzy.json"), "utf8"));
  assert.notEqual(twice.items[0].id, itzy.items[0].id);
});

test("expired API metadata is removed while the file remains schema-valid", async (t) => {
  const dataFile = await fixture(t);
  await syncTwice({ apiKey: "test-key", fetchImpl: mockFetch, dataFile, now: TIME });
  const channel = (await loadChannels()).find((item) => item.artistId === "twice");
  assert.equal(await expireStaleChannel(channel, dataFile, "2026-11-15T00:00:00.000Z"), true);
  const snapshot = parseContentSnapshot(JSON.parse(await readFile(dataFile, "utf8")));
  assert.ok(snapshot);
  assert.equal(snapshot.items.length, 0);
  assert.equal(snapshot.fetchedAt, null);
});
