export type ContentKind =
  "music-video" | "performance" | "teaser" | "announcement" | "other";

export interface Content {
  id: string;
  source: {
    platform: "youtube";
    videoId: string;
    channelId: string;
    verification: "official-channel";
  };
  artist: { id: string; name: string };
  title: string;
  description: string;
  /** Optional future translation fields; title/description remain the original API metadata. */
  originalTitle?: string;
  localizedTitle?: string;
  originalDescription?: string;
  localizedDescription?: string;
  originalLanguage?: string;
  translationVerified?: boolean;
  thumbnail: string;
  publishedAt: string;
  url: string;
  fetchedAt: string;
  type: ContentKind;
}

export interface ContentSnapshot {
  schemaVersion: 1;
  channelId: string;
  uploadsPlaylistId: string;
  fetchedAt: string | null;
  items: Content[];
}

export const TWICE_CHANNEL_ID = "UCzgxx_DM2Dcb9Y1spb9mUJA";
export const TWICE_UPLOADS_ID = "UUzgxx_DM2Dcb9Y1spb9mUJA";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const KINDS = new Set<ContentKind>([
  "music-video",
  "performance",
  "teaser",
  "announcement",
  "other",
]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function utcTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    UTC_TIME.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isYouTubeThumbnail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com";
  } catch {
    return false;
  }
}

export function isContent(value: unknown): value is Content {
  if (!record(value) || !record(value.source) || !record(value.artist))
    return false;
  const videoId = value.source.videoId;
  return (
    typeof videoId === "string" &&
    VIDEO_ID.test(videoId) &&
    value.id === `yt-${videoId}` &&
    value.source.platform === "youtube" &&
    value.source.channelId === TWICE_CHANNEL_ID &&
    value.source.verification === "official-channel" &&
    value.artist.id === "twice" &&
    value.artist.name === "TWICE" &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= 200 &&
    typeof value.description === "string" &&
    value.description.length <= 280 &&
    (value.originalTitle === undefined ||
      (typeof value.originalTitle === "string" &&
        value.originalTitle.length <= 200)) &&
    (value.originalDescription === undefined ||
      (typeof value.originalDescription === "string" &&
        value.originalDescription.length <= 280)) &&
    (value.originalLanguage === undefined ||
      (typeof value.originalLanguage === "string" &&
        value.originalLanguage.length <= 30)) &&
    (value.localizedTitle === undefined ||
      (typeof value.localizedTitle === "string" &&
        value.localizedTitle.length <= 200)) &&
    (value.localizedDescription === undefined ||
      (typeof value.localizedDescription === "string" &&
        value.localizedDescription.length <= 280)) &&
    ((value.localizedTitle === undefined &&
      value.localizedDescription === undefined) ||
      value.translationVerified === true) &&
    isYouTubeThumbnail(value.thumbnail) &&
    utcTime(value.publishedAt) &&
    value.url === `https://www.youtube.com/watch?v=${videoId}` &&
    utcTime(value.fetchedAt) &&
    KINDS.has(value.type as ContentKind)
  );
}

export function parseContentSnapshot(value: unknown): ContentSnapshot | null {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    value.channelId !== TWICE_CHANNEL_ID ||
    value.uploadsPlaylistId !== TWICE_UPLOADS_ID ||
    !(value.fetchedAt === null || utcTime(value.fetchedAt)) ||
    !Array.isArray(value.items) ||
    value.items.length > 200 ||
    !value.items.every(isContent)
  )
    return null;
  const items = value.items as Content[];
  if (new Set(items.map((item) => item.id)).size !== items.length) return null;
  return value as unknown as ContentSnapshot;
}
