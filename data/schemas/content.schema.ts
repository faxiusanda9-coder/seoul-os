import { contentCategories, type ContentCategory, type Classification } from "../../src/utils/contentClassifier.ts";

export type ContentKind =
  "music-video" | "performance" | "teaser" | "announcement" | "other";

export type ThumbnailQuality = "default" | "medium" | "high" | "standard" | "maxres" | "fhd" | "qhd" | "uhd";
export interface ThumbnailVariant {
  quality: ThumbnailQuality;
  url: string;
  width: number;
  height: number;
}

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
  /** API-provided variants only. Absent in schema v1 snapshots. */
  thumbnails?: ThumbnailVariant[];
  publishedAt: string;
  url: string;
  fetchedAt: string;
  availabilityStatus?: "public";
  lastValidatedAt?: string;
  type: ContentKind;
  /** SEOUL.OS editorial classification; required in schema v3 snapshots. */
  category?: ContentCategory;
  subcategory?: string;
  classification?: Classification;
}

export interface ChannelConfig {
  channelId: string | null;
  artistId: string;
  displayName: string;
  uploadsPlaylistId: string | null;
  officialUrl: string | null;
  verificationStatus: "web-verified" | "pending";
  enabled: boolean;
  lastVerifiedAt: string | null;
}

export interface ChannelsConfig {
  schemaVersion: 1;
  channels: ChannelConfig[];
}

export interface ContentSnapshot {
  schemaVersion: 1 | 2 | 3;
  channelId: string;
  uploadsPlaylistId: string;
  artistId?: string;
  syncStatus?: "ok" | "empty";
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
const CATEGORIES = new Set<ContentCategory>(contentCategories);
const THUMBNAIL_QUALITIES = new Set<ThumbnailQuality>([
  "default", "medium", "high", "standard", "maxres", "fhd", "qhd", "uhd",
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

function isThumbnailVariant(value: unknown): value is ThumbnailVariant {
  return record(value) && THUMBNAIL_QUALITIES.has(value.quality as ThumbnailQuality) &&
    isYouTubeThumbnail(value.url) && Number.isInteger(value.width) &&
    Number.isInteger(value.height) && (value.width as number) > 0 &&
    (value.height as number) > 0;
}

export function isContent(value: unknown, channel?: ChannelConfig): value is Content {
  if (!record(value) || !record(value.source) || !record(value.artist))
    return false;
  const videoId = value.source.videoId;
  return (
    typeof videoId === "string" &&
    VIDEO_ID.test(videoId) &&
    value.id === `yt-${videoId}` &&
    value.source.platform === "youtube" &&
    value.source.channelId === (channel?.channelId ?? TWICE_CHANNEL_ID) &&
    value.source.verification === "official-channel" &&
    value.artist.id === (channel?.artistId ?? "twice") &&
    value.artist.name === (channel?.displayName ?? "TWICE") &&
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
    (value.thumbnails === undefined || (Array.isArray(value.thumbnails) &&
      value.thumbnails.length > 0 && value.thumbnails.length <= THUMBNAIL_QUALITIES.size &&
      value.thumbnails.every(isThumbnailVariant) &&
      new Set(value.thumbnails.map((item: ThumbnailVariant) => item.quality)).size === value.thumbnails.length &&
      value.thumbnails.some((item: ThumbnailVariant) => item.url === value.thumbnail))) &&
    utcTime(value.publishedAt) &&
    value.url === `https://www.youtube.com/watch?v=${videoId}` &&
    utcTime(value.fetchedAt) &&
    (value.availabilityStatus === undefined || value.availabilityStatus === "public") &&
    (value.lastValidatedAt === undefined || utcTime(value.lastValidatedAt)) &&
    KINDS.has(value.type as ContentKind) &&
    (value.category === undefined || CATEGORIES.has(value.category as ContentCategory)) &&
    (value.subcategory === undefined || (typeof value.subcategory === "string" &&
      value.subcategory.length > 0 && value.subcategory.length <= 80)) &&
    (value.classification === undefined || (record(value.classification) &&
      ["rule", "fallback"].includes(String(value.classification.method)) &&
      typeof value.classification.ruleId === "string" &&
      value.classification.ruleId.length > 0 && value.classification.ruleId.length <= 80 &&
      typeof value.classification.confidence === "number" &&
      value.classification.confidence >= 0 && value.classification.confidence <= 1))
  );
}

export function parseChannelSnapshot(value: unknown, channel: ChannelConfig): ContentSnapshot | null {
  if (
    !record(value) ||
    ![1, 2, 3].includes(value.schemaVersion as number) ||
    value.channelId !== channel.channelId ||
    value.uploadsPlaylistId !== channel.uploadsPlaylistId ||
    (value.artistId !== undefined && value.artistId !== channel.artistId) ||
    (value.syncStatus !== undefined && !["ok", "empty"].includes(String(value.syncStatus))) ||
    !(value.fetchedAt === null || utcTime(value.fetchedAt)) ||
    !Array.isArray(value.items) ||
    value.items.length > 200 ||
    !value.items.every((item: unknown) => isContent(item, channel))
  )
    return null;
  const items = value.items as Content[];
  if (value.schemaVersion === 3 && items.some((item) => !item.category || !item.classification ||
    (item.category === "other" && item.classification.method !== "fallback") ||
    (item.category !== "other" && item.classification.method !== "rule"))) return null;
  if (new Set(items.map((item) => item.id)).size !== items.length) return null;
  return value as unknown as ContentSnapshot;
}

export function parseContentSnapshot(value: unknown): ContentSnapshot | null {
  return parseChannelSnapshot(value, {
    channelId: TWICE_CHANNEL_ID,
    artistId: "twice",
    displayName: "TWICE",
    uploadsPlaylistId: TWICE_UPLOADS_ID,
    officialUrl: "https://www.youtube.com/c/twice",
    verificationStatus: "web-verified",
    enabled: true,
    lastVerifiedAt: "2026-10-14",
  });
}

export function parseChannelsConfig(value: unknown): ChannelsConfig | null {
  if (!record(value) || value.schemaVersion !== 1 || !Array.isArray(value.channels)) return null;
  const channels = value.channels;
  if (!channels.every((item: unknown) => {
    if (!record(item)) return false;
    const verified = item.verificationStatus === "web-verified";
    return typeof item.artistId === "string" && /^[a-z0-9-]+$/.test(item.artistId) &&
      typeof item.displayName === "string" && item.displayName.length > 0 &&
      typeof item.enabled === "boolean" &&
      ["web-verified", "pending"].includes(String(item.verificationStatus)) &&
      (item.lastVerifiedAt === null || (typeof item.lastVerifiedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.lastVerifiedAt))) &&
      (verified ? typeof item.channelId === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(item.channelId) &&
        item.uploadsPlaylistId === `UU${item.channelId.slice(2)}` &&
        typeof item.officialUrl === "string" && item.officialUrl.startsWith("https://www.youtube.com/")
        : item.channelId === null && item.uploadsPlaylistId === null && item.officialUrl === null && item.enabled === false) &&
      (!item.enabled || verified);
  })) return null;
  const typed = channels as ChannelConfig[];
  if (new Set(typed.map((item) => item.artistId)).size !== typed.length) return null;
  if (new Set(typed.filter((item) => item.channelId).map((item) => item.channelId)).size !== typed.filter((item) => item.channelId).length) return null;
  return value as unknown as ChannelsConfig;
}
