export type EventSource = "ticketmaster" | "youtube" | "manual-official";
export type EventKind =
  | "concert"
  | "fan-meeting"
  | "livestream"
  | "release"
  | "ticket-sale"
  | "other";
export type EventLifecycle =
  | "scheduled"
  | "postponed"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "unknown";
export type EventVerification =
  "verified" | "pending-review" | "rejected" | "source-unavailable";

/** Event metadata is separate from the old 2099 UI demonstration fixtures. */
export interface CalendarEventRecord {
  id: string;
  artistId: string;
  title: string;
  eventType: EventKind;
  source: EventSource;
  sourceEventId: string;
  sourceUrl: string;
  verification: EventVerification;
  lifecycle: EventLifecycle;
  startAt: string | null;
  endAt: string | null;
  localDate: string | null;
  localTime: string | null;
  timezone: string | null;
  timePrecision: "datetime" | "date" | "unknown";
  venueName?: string;
  city?: string;
  country?: string;
  ticketStatus?: "onsale" | "offsale" | "unknown";
  firstSeenAt: string;
  lastVerifiedAt: string | null;
  updatedAt: string;
  sequence: number;
  published: boolean;
}

export interface CalendarSnapshot {
  schemaVersion: 1;
  generatedAt: string | null;
  sourceStatus: {
    ticketmaster: "ready" | "blocked" | "failed";
    manual: "ready" | "failed";
  };
  events: CalendarEventRecord[];
}
