import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseChannelSnapshot, parseChannelsConfig } from "../data/schemas/content.schema.ts";

const API_ROOT = "https://www.googleapis.com/youtube/v3";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_MS = RETENTION_MS / 2;

export async function loadChannels() {
  const raw = JSON.parse(await readFile(resolve("data/youtube/channels.json"), "utf8"));
  const config = parseChannelsConfig(raw);
  if (!config) throw new Error("Channel configuration failed validation");
  return config.channels;
}

const dataPath = (artistId) => resolve(`data/youtube/${artistId}.json`);
const emptySnapshot = (channel) => ({ schemaVersion: 1, channelId: channel.channelId,
  uploadsPlaylistId: channel.uploadsPlaylistId, artistId: channel.artistId,
  syncStatus: "empty", fetchedAt: null, items: [] });

async function existingSnapshot(channel, file) {
  let raw;
  try { raw = await readFile(file, "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") return emptySnapshot(channel);
    throw error;
  }
  const parsed = parseChannelSnapshot(JSON.parse(raw), channel);
  if (!parsed) throw new Error(`${channel.artistId}: existing snapshot failed validation`);
  return parsed;
}

async function atomicWrite(file, snapshot) {
  const temp = `${file}.tmp`;
  await writeFile(temp, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(temp, file);
}

function typeFromTitle(title) {
  // SEOUL.OS editorial type, not a YouTube API classification.
  if (/\b(m\/v|music video|official mv)\b/i.test(title)) return "music-video";
  if (/performance|dance practice|stage|choreography/i.test(title)) return "performance";
  if (/teaser|trailer|highlight medley/i.test(title)) return "teaser";
  if (/announcement|notice/i.test(title)) return "announcement";
  return "other";
}

async function request(part, params, apiKey, fetchImpl, counter) {
  const url = new URL(`${API_ROOT}/${part}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("key", apiKey);
  for (let attempt = 0; attempt < 3; attempt++) {
    counter.requests++;
    let response;
    try {
      response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    } catch {
      if (attempt < 2) { counter.retries++; await new Promise((done) => setTimeout(done, 250 * (attempt + 1))); continue; }
      throw new Error(`YouTube ${part}.list network request failed`);
    }
    if (response.ok) return response.json();
    if (response.status === 403) {
      let reason = "";
      try { reason = (await response.json()).error?.errors?.[0]?.reason ?? ""; } catch { /* no body */ }
      const exhausted = ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(reason);
      const error = new Error(`YouTube ${part}.list returned HTTP 403${exhausted ? " (quota exceeded)" : ""}`);
      error.quotaExceeded = exhausted;
      throw error;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      counter.retries++;
      await new Promise((done) => setTimeout(done, 250 * (attempt + 1)));
      continue;
    }
    throw new Error(`YouTube ${part}.list returned HTTP ${response.status}`);
  }
  throw new Error(`YouTube ${part}.list failed after bounded retries`);
}

function normalizeVideo(video, now, channel) {
  const id = video?.id;
  const snippet = video?.snippet;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(id) ||
      snippet?.channelId !== channel.channelId || !snippet?.title || !snippet?.publishedAt ||
      video?.status?.privacyStatus !== "public") return null;
  const thumbnail = ["medium", "default", "high"]
    .map((size) => snippet.thumbnails?.[size]?.url)
    .find((url) => typeof url === "string" && /^https:\/\/i\.ytimg\.com\//.test(url));
  if (!thumbnail) return null;
  const title = snippet.title.trim().slice(0, 200);
  return {
    id: `yt-${id}`,
    source: { platform: "youtube", videoId: id, channelId: channel.channelId, verification: "official-channel" },
    artist: { id: channel.artistId, name: channel.displayName },
    title, description: (snippet.description ?? "").slice(0, 280), thumbnail,
    publishedAt: new Date(snippet.publishedAt).toISOString(),
    url: `https://www.youtube.com/watch?v=${id}`,
    fetchedAt: now, availabilityStatus: "public", lastValidatedAt: now,
    type: typeFromTitle(title),
  };
}

export async function syncChannel({ channel, apiKey = process.env.YOUTUBE_API_KEY,
  fetchImpl = fetch, dataFile = dataPath(channel.artistId), now = new Date().toISOString(),
  counter = { requests: 0, retries: 0 } } = {}) {
  if (!channel?.enabled || channel.verificationStatus !== "web-verified" || !channel.channelId || !channel.uploadsPlaylistId)
    throw new Error("Channel is not verified and enabled");
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is missing; existing data was not changed");
  const previous = await existingSnapshot(channel, dataFile);
  const channels = await request("channels", { part: "contentDetails", id: channel.channelId }, apiKey, fetchImpl, counter);
  const uploadsId = channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (channels.items?.[0]?.id !== channel.channelId || uploadsId !== channel.uploadsPlaylistId)
    throw new Error(`${channel.artistId}: channel/uploads identity did not match verified IDs`);
  const playlist = await request("playlistItems", { part: "contentDetails", playlistId: uploadsId, maxResults: "50" }, apiKey, fetchImpl, counter);
  const ids = [...new Set((playlist.items ?? []).map((item) => item.contentDetails?.videoId)
    .filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id)))];
  if (!ids.length) throw new Error(`${channel.artistId}: uploads list was empty; existing data was not changed`);
  const videos = await request("videos", { part: "snippet,status", id: ids.join(",") }, apiKey, fetchImpl, counter);
  const oldById = new Map(previous.items.map((item) => [item.id, item]));
  const fresh = (videos.items ?? []).filter((video) => ids.includes(video?.id))
    .map((video) => normalizeVideo(video, now, channel)).filter(Boolean);
  if (!fresh.length) throw new Error(`${channel.artistId}: no valid public videos; existing data was not changed`);
  const items = fresh.map((item) => {
    const old = oldById.get(item.id);
    if (old) {
      const { fetchedAt: _oldTime, lastValidatedAt: _oldValidated, ...oldMetadata } = old;
      const { fetchedAt: _newTime, lastValidatedAt: _newValidated, ...newMetadata } = item;
      if (JSON.stringify(oldMetadata) === JSON.stringify(newMetadata) &&
          Date.parse(now) - Date.parse(old.fetchedAt) < REFRESH_MS) return old;
    }
    return item;
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
  const changed = JSON.stringify(previous.items) !== JSON.stringify(items) ||
    previous.artistId !== channel.artistId || previous.syncStatus !== "ok";
  const newCount = items.filter((item) => !oldById.has(item.id)).length;
  const updatedCount = items.filter((item) => oldById.has(item.id) && item !== oldById.get(item.id)).length;
  if (!changed) return { changed: false, count: items.length, newCount, updatedCount, ...counter };
  const next = { schemaVersion: 1, channelId: channel.channelId, uploadsPlaylistId: channel.uploadsPlaylistId,
    artistId: channel.artistId, syncStatus: "ok", fetchedAt: now, items };
  if (!parseChannelSnapshot(next, channel)) throw new Error(`${channel.artistId}: generated snapshot failed validation`);
  await atomicWrite(dataFile, next);
  return { changed: true, count: items.length, newCount, updatedCount, ...counter };
}

export async function expireStaleChannel(channel, dataFile = dataPath(channel.artistId), now = new Date().toISOString()) {
  const old = await existingSnapshot(channel, dataFile);
  if (!old.fetchedAt || !old.items.length || Date.parse(now) - Date.parse(old.fetchedAt) < RETENTION_MS) return false;
  await atomicWrite(dataFile, emptySnapshot(channel));
  return true;
}

export async function syncTwice(options = {}) {
  const channel = (await loadChannels()).find((item) => item.artistId === "twice");
  const result = await syncChannel({ channel, ...options });
  return { changed: result.changed, count: result.count };
}

export async function syncEnabledChannels({ artistId = "all", apiKey = process.env.YOUTUBE_API_KEY,
  fetchImpl = fetch, dataDir = resolve("data/youtube") } = {}) {
  const enabled = (await loadChannels()).filter((item) => item.enabled);
  const selected = artistId === "all" ? enabled : enabled.filter((item) => item.artistId === artistId);
  if (!selected.length) throw new Error(`No enabled verified channel matches ${artistId}`);
  const results = [];
  let quotaExceeded = false;
  for (const channel of selected) {
    if (quotaExceeded) { results.push({ artistId: channel.artistId, status: "skipped", reason: "quota exceeded" }); continue; }
    const counter = { requests: 0, retries: 0 };
    try {
      const result = await syncChannel({ channel, apiKey, fetchImpl,
        dataFile: resolve(dataDir, `${channel.artistId}.json`), counter });
      results.push({ artistId: channel.artistId, status: "success", ...result });
    } catch (error) {
      quotaExceeded = Boolean(error.quotaExceeded);
      const expired = await expireStaleChannel(channel, resolve(dataDir, `${channel.artistId}.json`));
      results.push({ artistId: channel.artistId, status: "failed", reason: error.message, expired, ...counter });
    }
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const artistId = process.argv.find((value) => value.startsWith("--channel="))?.slice(10) || "all";
  syncEnabledChannels({ artistId }).then((results) => {
    for (const result of results) console.log(`${result.artistId}: ${result.status}; videos=${result.count ?? 0}; new=${result.newCount ?? 0}; updated=${result.updatedCount ?? 0}; requests=${result.requests ?? 0}; retries=${result.retries ?? 0}${result.reason ? `; ${result.reason}` : ""}${result.expired ? "; expired metadata removed" : ""}`);
    const requests = results.reduce((sum, item) => sum + (item.requests ?? 0), 0);
    console.log(`Total API requests: ${requests}; estimated quota units: ${requests}`);
    if (results.some((item) => item.status === "failed")) process.exitCode = 1;
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
