import { parseEvent } from "../../src/calendar/engine.ts";

/** Channel-scoped only. Never merge results into public all-channel calendar/ICS. */
export function normalizeUpcomingLive(video, channel, now) {
  const id = video?.id;
  const details = video?.liveStreamingDetails;
  const scheduled = details?.scheduledStartTime;
  if (
    !/^[A-Za-z0-9_-]{11}$/.test(id ?? "") ||
    video?.snippet?.channelId !== channel.channelId ||
    video?.snippet?.liveBroadcastContent !== "upcoming" ||
    !scheduled ||
    Number.isNaN(Date.parse(scheduled)) ||
    details?.actualEndTime
  )
    return null;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(scheduled));
  const part = (name) => parts.find((item) => item.type === name)?.value;
  const event = {
    id: `yt-${id}`,
    artistId: channel.artistId,
    title: video.snippet.title,
    eventType: "livestream",
    source: "youtube",
    sourceEventId: id,
    sourceUrl: `https://www.youtube.com/watch?v=${id}`,
    verification: "verified",
    lifecycle: "scheduled",
    startAt: scheduled,
    endAt: details.scheduledEndTime ?? null,
    localDate: `${part("year")}-${part("month")}-${part("day")}`,
    localTime: `${part("hour")}:${part("minute")}`,
    timezone: "Asia/Seoul",
    timePrecision: "datetime",
    firstSeenAt: now,
    lastVerifiedAt: now,
    updatedAt: now,
    sequence: 0,
    published: true,
  };
  return parseEvent(event, new Set([channel.artistId]));
}
