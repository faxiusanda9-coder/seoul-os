import { readFile } from "node:fs/promises";
import { normalizeUpcomingLive } from "./youtube-live-adapter.mjs";

const artistId =
  process.argv.find((arg) => arg.startsWith("--channel="))?.slice(10) ??
  "twice";
const config = JSON.parse(
  await readFile(
    new URL("../../data/youtube/channels.json", import.meta.url),
    "utf8",
  ),
);
const channel = config.channels.find(
  (item) =>
    item.artistId === artistId &&
    item.enabled &&
    item.verificationStatus === "web-verified",
);
if (!channel) throw new Error("Choose a verified enabled channel");
if (!process.env.YOUTUBE_API_KEY) {
  console.log(
    JSON.stringify({
      channel: artistId,
      status: "blocked",
      reason: "YOUTUBE_API_KEY unavailable",
      requests: 0,
    }),
  );
  process.exit(0);
}
const snapshot = JSON.parse(
  await readFile(
    new URL(`../../data/youtube/${artistId}.json`, import.meta.url),
    "utf8",
  ),
);
if (snapshot.channelId !== channel.channelId || !Array.isArray(snapshot.items))
  throw new Error("Local channel snapshot invalid");
const ids = snapshot.items
  .map((item) => item.source?.videoId)
  .filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id))
  .slice(0, 50);
if (!ids.length)
  throw new Error("No valid video IDs in current channel snapshot");
const url = new URL("https://www.googleapis.com/youtube/v3/videos");
url.searchParams.set("part", "snippet,liveStreamingDetails,status");
url.searchParams.set("id", ids.join(","));
url.searchParams.set("key", process.env.YOUTUBE_API_KEY);
let response;
try {
  response = await fetch(url, { signal: AbortSignal.timeout(10000) });
} catch {
  throw new Error("YouTube live pilot network error");
}
if (!response.ok) throw new Error(`YouTube live pilot HTTP ${response.status}`);
const body = await response.json();
if (!Array.isArray(body.items))
  throw new Error("YouTube live pilot response invalid");
const now = new Date().toISOString();
const upcoming = body.items
  .filter((item) => item.status?.privacyStatus === "public")
  .map((item) => normalizeUpcomingLive(item, channel, now))
  .filter(Boolean);
console.log(
  JSON.stringify({
    channel: artistId,
    status: "queried",
    requests: 1,
    checkedVideoIds: ids.length,
    returnedVideos: body.items.length,
    verifiedUpcoming: upcoming.length,
    note: "Read-only channel pilot; uploads snapshot may not include all upcoming broadcasts; no cross-channel calendar publication.",
  }),
);
