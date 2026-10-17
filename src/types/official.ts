export type NoticeCategory =
  | "comeback" | "release" | "concert" | "ticket" | "merchandise"
  | "teaser" | "fan-event" | "anniversary" | "media"
  | "official-notice" | "other";

/** Reserved for a source with explicit permission to publish metadata. No live JYP adapter is enabled. */
export interface OfficialNotice {
  id: string;
  artistId: string;
  sourceId: string;
  sourceUrl: string;
  sourceType: "jyp-official";
  originalTitle: string;
  localizedTitle?: string;
  publishedAt: string | null;
  publishedDatePrecision: "date" | "datetime" | "unknown";
  noticeCategory: NoticeCategory;
  classificationMethod: "source" | "rule" | "manual";
  verified: boolean;
  firstSeenAt: string;
  lastCheckedAt: string;
}

/** Event occurrence is separate from announcement publication time. */
export interface OfficialEvent {
  id: string;
  artistId: string;
  title: string;
  sourceUrl: string;
  eventCategory: string;
  startAt: string | null;
  endAt?: string | null;
  localDate?: string;
  timezone?: string;
  allDay: boolean;
  timeConfirmed: boolean;
  sourceStatus: "verified" | "pending";
  lastCheckedAt: string;
}

export interface OfficialSource {
  artistId: string;
  noticeUrl?: string;
  scheduleUrl?: string;
  releaseUrl?: string;
  sourceType: "jyp-site" | "artist-site" | "none";
  authorizationBasis: string;
  accessStatus: "public" | "unverified";
  dataAvailability: "notice-and-schedule" | "notice-only" | "none";
  automationAllowed: false;
  lastCheckedAt: string;
  reason: string;
  evidenceUrl: string;
}

export interface OfficialSocialAccount {
  artistId: string;
  platform: "x";
  accountUrl: string;
  accountHandle: string;
  verifiedBy: string;
  verifiedAt: string;
  enabled: true;
}
