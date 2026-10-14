import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  parseContentSnapshot,
  TWICE_CHANNEL_ID,
  TWICE_UPLOADS_ID,
} from "../data/schemas/content.schema.ts";

const DEFAULT_FILE = resolve("data/youtube/twice.json");
const API_ROOT = "https://www.googleapis.com/youtube/v3";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function typeFromTitle(title) {
  if (/\b(m\/v|music video|official mv)\b/i.test(title)) return "music-video";
  if (/performance|dance practice|stage|choreography/i.test(title))
    return "performance";
  if (/teaser|trailer|highlight medley/i.test(title)) return "teaser";
  if (/announcement|notice/i.test(title)) return "announcement";
  return "other";
}

async function request(part, params, apiKey, fetchImpl) {
  const url = new URL(`${API_ROOT}/${part}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  url.searchParams.set("key", apiKey);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error(`YouTube ${part} request failed`);
  }
  if (!response.ok)
    throw new Error(`YouTube ${part} returned HTTP ${response.status}`);
  return response.json();
}

function normalizeVideo(video, now) {
  const id = video?.id;
  const snippet = video?.snippet;
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{11}$/.test(id) ||
    snippet?.channelId !== TWICE_CHANNEL_ID ||
    !snippet?.title ||
    !snippet?.publishedAt ||
    video?.status?.privacyStatus !== "public"
  )
    return null;
  const thumbnail = ["medium", "default", "high"]
    .map((size) => snippet.thumbnails?.[size]?.url)
    .find(
      (url) =>
        typeof url === "string" && /^https:\/\/i\.ytimg\.com\//.test(url),
    );
  if (!thumbnail) return null;
  const title = snippet.title.trim().slice(0, 200);
  return {
    id: `yt-${id}`,
    source: {
      platform: "youtube",
      videoId: id,
      channelId: TWICE_CHANNEL_ID,
      verification: "official-channel",
    },
    artist: { id: "twice", name: "TWICE" },
    title,
    description: (snippet.description ?? "").slice(0, 280),
    thumbnail,
    publishedAt: new Date(snippet.publishedAt).toISOString(),
    url: `https://www.youtube.com/watch?v=${id}`,
    fetchedAt: now,
    type: typeFromTitle(title),
  };
}

export async function syncTwice({
  apiKey = process.env.YOUTUBE_API_KEY,
  fetchImpl = fetch,
  dataFile = DEFAULT_FILE,
  now = new Date().toISOString(),
} = {}) {
  if (!apiKey)
    throw new Error(
      "YOUTUBE_API_KEY is missing; existing data was not changed",
    );
  const oldText = await readFile(dataFile, "utf8");
  const previous = parseContentSnapshot(JSON.parse(oldText));
  if (!previous)
    throw new Error(
      "Existing snapshot failed validation; refusing to overwrite",
    );

  const channels = await request(
    "channels",
    { part: "contentDetails", id: TWICE_CHANNEL_ID },
    apiKey,
    fetchImpl,
  );
  const channel = channels.items?.[0];
  const uploadsId = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (channel?.id !== TWICE_CHANNEL_ID || uploadsId !== TWICE_UPLOADS_ID)
    throw new Error(
      "TWICE channel/uploads identity did not match verified IDs",
    );

  const playlist = await request(
    "playlistItems",
    { part: "contentDetails", playlistId: uploadsId, maxResults: "50" },
    apiKey,
    fetchImpl,
  );
  const ids = [
    ...new Set(
      (playlist.items ?? [])
        .map((item) => item.contentDetails?.videoId)
        .filter(
          (id) => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id),
        ),
    ),
  ];
  if (!ids.length)
    throw new Error("Uploads list was empty; existing data was not changed");

  const videos = await request(
    "videos",
    { part: "snippet,status", id: ids.join(",") },
    apiKey,
    fetchImpl,
  );
  const oldById = new Map(previous.items.map((item) => [item.id, item]));
  const fresh = (videos.items ?? [])
    .map((video) => normalizeVideo(video, now))
    .filter(Boolean);
  if (!fresh.length)
    throw new Error(
      "No valid public TWICE videos returned; existing data was not changed",
    );
  // Keep only videos still present and public in this verified uploads window.
  // Reusing older rows here could continue publishing deleted/private videos.
  const retained = new Map();
  for (const item of fresh) {
    const old = oldById.get(item.id);
    if (old) {
      const { fetchedAt: _oldTime, ...oldMetadata } = old;
      const { fetchedAt: _newTime, ...newMetadata } = item;
      if (
        JSON.stringify(oldMetadata) === JSON.stringify(newMetadata) &&
        Date.parse(now) - Date.parse(old.fetchedAt) < RETENTION_MS / 2
      ) {
        retained.set(item.id, old);
        continue;
      }
    }
    retained.set(item.id, item);
  }
  const items = [...retained.values()]
    .sort(
      (a, b) =>
        b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
    )
    .slice(0, 200);
  const changed = JSON.stringify(previous.items) !== JSON.stringify(items);
  if (!changed) return { changed: false, count: items.length };
  const next = {
    schemaVersion: 1,
    channelId: TWICE_CHANNEL_ID,
    uploadsPlaylistId: TWICE_UPLOADS_ID,
    fetchedAt: now,
    items,
  };
  if (!parseContentSnapshot(next))
    throw new Error("Generated snapshot failed validation");
  const tempFile = `${dataFile}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(next, null, 2)}\n`);
  await rename(tempFile, dataFile);
  return { changed: true, count: items.length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  syncTwice()
    .then(({ changed, count }) =>
      console.log(
        `TWICE sync: ${count} videos; ${changed ? "data updated" : "no change"}`,
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
