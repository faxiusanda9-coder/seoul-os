import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncTwice } from "../scripts/youtube-sync.mjs";
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
