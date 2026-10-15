import type {
  CalendarEventRecord,
  CalendarSnapshot,
  EventLifecycle,
  EventKind,
} from "./types";

const kinds: ReadonlySet<string> = new Set<EventKind>([
  "concert",
  "fan-meeting",
  "livestream",
  "release",
  "ticket-sale",
  "other",
]);
const lifecycles: ReadonlySet<string> = new Set<EventLifecycle>([
  "scheduled",
  "postponed",
  "rescheduled",
  "cancelled",
  "completed",
  "unknown",
]);
const sources = new Set(["ticketmaster", "youtube", "manual-official"]);
const verification = new Set([
  "verified",
  "pending-review",
  "rejected",
  "source-unavailable",
]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}(?::\d{2})?$/;
const validDate = (value: string) =>
  datePattern.test(value) &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const timestamp = (value: unknown) =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
const clean = (value: unknown, max = 300) =>
  typeof value === "string" &&
  !!value.trim() &&
  value.length <= max &&
  !/[\u0000-\u001f]/.test(value);

export function safeEventUrl(raw: unknown, source: string): boolean {
  if (typeof raw !== "string") return false;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.searchParams.has("apikey") ||
      url.searchParams.has("key")
    )
      return false;
    const host = url.hostname.toLowerCase();
    if (source === "ticketmaster")
      return (
        host === "ticketmaster.com" ||
        host.endsWith(".ticketmaster.com") ||
        /^([a-z0-9-]+\.)?ticketmaster\.(co\.uk|de|fr|es|nl|be|ca|com\.au|co\.nz|ie|at|ch|se|no|dk|fi|it|pl|cz|mx|com\.br|co\.jp)$/.test(
          host,
        )
      );
    if (source === "youtube")
      return (
        host === "www.youtube.com" &&
        url.pathname === "/watch" &&
        /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get("v") ?? "")
      );
    return (
      host === "jype.com" ||
      host.endsWith(".jype.com") ||
      host === "niziu.com" ||
      host === "www.niziu.com" ||
      host === "x.com" ||
      host === "twitter.com"
    );
  } catch {
    return false;
  }
}

export function parseEvent(
  value: unknown,
  artistIds: ReadonlySet<string>,
): CalendarEventRecord | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    !clean(v.id, 120) ||
    !/^(tm|yt|manual)-[A-Za-z0-9_-]{1,110}$/.test(String(v.id)) ||
    !artistIds.has(String(v.artistId)) ||
    !clean(v.title, 250) ||
    !kinds.has(String(v.eventType)) ||
    !sources.has(String(v.source)) ||
    !clean(v.sourceEventId, 120) ||
    !safeEventUrl(v.sourceUrl, String(v.source)) ||
    !verification.has(String(v.verification)) ||
    !lifecycles.has(String(v.lifecycle)) ||
    !timestamp(v.firstSeenAt) ||
    !timestamp(v.updatedAt) ||
    (v.lastVerifiedAt !== null && !timestamp(v.lastVerifiedAt)) ||
    !Number.isInteger(v.sequence) ||
    Number(v.sequence) < 0 ||
    typeof v.published !== "boolean"
  )
    return null;
  if (!["datetime", "date", "unknown"].includes(String(v.timePrecision)))
    return null;
  if (
    v.localDate !== null &&
    (typeof v.localDate !== "string" || !validDate(v.localDate))
  )
    return null;
  if (
    v.localTime !== null &&
    (typeof v.localTime !== "string" || !timePattern.test(v.localTime))
  )
    return null;
  if (v.startAt !== null && !timestamp(v.startAt)) return null;
  if (v.endAt !== null && !timestamp(v.endAt)) return null;
  if (
    v.timezone !== null &&
    (typeof v.timezone !== "string" || !isTimeZone(v.timezone))
  )
    return null;
  if (
    v.timePrecision === "datetime" &&
    (!v.startAt || !v.localDate || !v.localTime || !v.timezone)
  )
    return null;
  if (
    v.timePrecision === "date" &&
    (!v.localDate || v.startAt !== null || v.localTime !== null)
  )
    return null;
  if (
    v.timePrecision === "unknown" &&
    (v.localDate !== null || v.startAt !== null || v.localTime !== null)
  )
    return null;
  if (
    v.startAt &&
    v.localDate &&
    v.timezone &&
    dateInZone(v.startAt as string, v.timezone as string) !== v.localDate
  )
    return null;
  if (v.startAt && v.localTime && v.timezone) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: v.timezone as string,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(v.startAt as string));
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (`${hour}:${minute}` !== (v.localTime as string).slice(0, 5))
      return null;
  }
  if (
    v.published &&
    (v.verification !== "verified" || v.timePrecision === "unknown")
  )
    return null;
  for (const key of ["venueName", "city", "country"] as const)
    if (v[key] !== undefined && !clean(v[key], 150)) return null;
  if (
    v.ticketStatus !== undefined &&
    !["onsale", "offsale", "unknown"].includes(String(v.ticketStatus))
  )
    return null;
  return v as unknown as CalendarEventRecord;
}

export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
export function dateInZone(instant: string, zone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function eventDate(event: CalendarEventRecord): string | null {
  return event.timePrecision === "datetime" && event.startAt
    ? dateInZone(event.startAt, "Asia/Shanghai")
    : event.localDate;
}
export function parseSnapshot(
  value: unknown,
  artistIds: ReadonlySet<string>,
): CalendarSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    v.schemaVersion !== 1 ||
    (v.generatedAt !== null && !timestamp(v.generatedAt)) ||
    !v.sourceStatus ||
    typeof v.sourceStatus !== "object" ||
    !Array.isArray(v.events)
  )
    return null;
  const status = v.sourceStatus as Record<string, unknown>;
  if (
    !["ready", "blocked", "failed"].includes(String(status.ticketmaster)) ||
    !["ready", "failed"].includes(String(status.manual))
  )
    return null;
  const parsed = v.events.map((event) => parseEvent(event, artistIds));
  if (
    parsed.some((event) => !event) ||
    new Set(parsed.map((event) => event!.id)).size !== parsed.length
  )
    return null;
  return v as unknown as CalendarSnapshot;
}

export function publishable(event: CalendarEventRecord): boolean {
  return (
    event.published &&
    event.verification === "verified" &&
    event.timePrecision !== "unknown" &&
    event.source !== "youtube"
  );
}
export function currentlyPublishable(
  event: CalendarEventRecord,
  now: string,
): boolean {
  return (
    publishable(event) &&
    (event.source !== "ticketmaster" ||
      (!!event.lastVerifiedAt &&
        Date.parse(now) - Date.parse(event.lastVerifiedAt) < 7 * 86400000))
  );
}

const transitions: Record<EventLifecycle, ReadonlySet<EventLifecycle>> = {
  scheduled: new Set([
    "scheduled",
    "postponed",
    "rescheduled",
    "cancelled",
    "completed",
  ]),
  postponed: new Set(["postponed", "rescheduled", "cancelled"]),
  rescheduled: new Set(["rescheduled", "postponed", "cancelled", "completed"]),
  cancelled: new Set(["cancelled"]),
  completed: new Set(["completed"]),
  unknown: new Set([
    "unknown",
    "scheduled",
    "postponed",
    "rescheduled",
    "cancelled",
    "completed",
  ]),
};
export const transitionAllowed = (from: EventLifecycle, to: EventLifecycle) =>
  transitions[from].has(to);

/** Similar records are only review candidates; never merged or published together automatically. */
export function possibleEventLinks(
  events: CalendarEventRecord[],
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < events.length; i++)
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i],
        b = events[j];
      if (
        a.source === b.source ||
        a.artistId !== b.artistId ||
        a.eventType !== b.eventType ||
        !a.localDate ||
        a.localDate !== b.localDate
      )
        continue;
      if (a.city && b.city && a.city.toLowerCase() !== b.city.toLowerCase())
        continue;
      if (
        a.venueName &&
        b.venueName &&
        a.venueName.toLowerCase() !== b.venueName.toLowerCase()
      )
        continue;
      pairs.push([a.id, b.id]);
    }
  return pairs;
}

/** Source failures do not imply cancellation; stale third-party metadata is hidden, then deleted. */
export function retainCalendarEvents(
  events: CalendarEventRecord[],
  incomingIds: ReadonlySet<string>,
  manualIds: ReadonlySet<string>,
  now: string,
): CalendarEventRecord[] {
  const sevenDays = 7 * 86400000;
  const thirtyDays = 30 * 86400000;
  const time = Date.parse(now);
  return events
    .filter((event) => {
      if (event.source === "manual-official") return manualIds.has(event.id);
      return (
        time - Date.parse(event.lastVerifiedAt ?? event.firstSeenAt) <
        thirtyDays
      );
    })
    .map((event) => {
      if (
        event.source === "ticketmaster" &&
        !incomingIds.has(event.id) &&
        time - Date.parse(event.lastVerifiedAt ?? event.firstSeenAt) >=
          sevenDays
      )
        return {
          ...event,
          published: false,
          verification: "source-unavailable",
        };
      return event;
    });
}

export function reconcile(
  previous: CalendarEventRecord[],
  incoming: CalendarEventRecord[],
  now: string,
): CalendarEventRecord[] {
  const old = new Map(previous.map((event) => [event.id, event]));
  const output = new Map(old);
  for (const event of incoming) {
    const prior = old.get(event.id);
    if (!prior) {
      output.set(event.id, event);
      continue;
    }
    const stable = { ...event, firstSeenAt: prior.firstSeenAt };
    if (!transitionAllowed(prior.lifecycle, stable.lifecycle)) {
      stable.verification = "pending-review";
      stable.published = false;
    }
    const changed = [
      "title",
      "eventType",
      "sourceUrl",
      "verification",
      "lifecycle",
      "startAt",
      "endAt",
      "localDate",
      "localTime",
      "timezone",
      "timePrecision",
      "venueName",
      "city",
      "country",
      "ticketStatus",
      "published",
    ].some(
      (key) =>
        JSON.stringify(prior[key as keyof CalendarEventRecord]) !==
        JSON.stringify(stable[key as keyof CalendarEventRecord]),
    );
    const recheckDue =
      event.source !== "manual-official" &&
      (prior.lastVerifiedAt === null ||
        Date.parse(now) - Date.parse(prior.lastVerifiedAt) >=
          24 * 60 * 60 * 1000);
    const manualReview =
      event.source === "manual-official" &&
      event.lastVerifiedAt &&
      (!prior.lastVerifiedAt ||
        Date.parse(event.lastVerifiedAt) > Date.parse(prior.lastVerifiedAt))
        ? event.lastVerifiedAt
        : null;
    if (event.source === "manual-official" && changed && !manualReview) {
      stable.verification = "pending-review";
      stable.published = false;
    }
    output.set(event.id, {
      ...stable,
      sequence: changed ? prior.sequence + 1 : prior.sequence,
      updatedAt: changed ? now : prior.updatedAt,
      lastVerifiedAt:
        manualReview ?? (changed || recheckDue ? now : prior.lastVerifiedAt),
    });
  }
  return [...output.values()].sort((a, b) => a.id.localeCompare(b.id));
}
