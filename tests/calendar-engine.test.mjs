import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEvent, parseSnapshot, publishable, currentlyPublishable, eventDate, reconcile, safeEventUrl, transitionAllowed, possibleEventLinks, retainCalendarEvents } from "../src/calendar/engine.ts";
import { calendarIcs } from "../src/calendar/ics.ts";
import { normalizeTicketmaster, normalizeTicketSale, discoverEvents, tmGet } from "../scripts/events/ticketmaster-adapter.mjs";
import { normalizeUpcomingLive } from "../scripts/events/youtube-live-adapter.mjs";
import { approvedManualEvents, addDraft, reviewDraft, verifiedManualSource } from "../scripts/events/manual-events.mjs";

const artistIds = new Set(["twice", "day6"]);
const now = "2026-10-15T00:00:00Z";
const base = { id: "manual-a", artistId: "twice", title: "Test concert", eventType: "concert", source: "manual-official", sourceEventId: "a", sourceUrl: "https://twice.jype.com/schedule", verification: "verified", lifecycle: "scheduled", startAt: "2026-11-01T00:30:00Z", endAt: null, localDate: "2026-11-01", localTime: "08:30", timezone: "Asia/Shanghai", timePrecision: "datetime", firstSeenAt: now, lastVerifiedAt: now, updatedAt: now, sequence: 0, published: true };
const tmRaw = { id: "G5test", name: "TWICE LIVE", url: "https://www.ticketmaster.com/event/G5test", dates: { start: { localDate: "2026-10-31", localTime: "20:30:00", dateTime: "2026-11-01T00:30:00Z" }, timezone: "America/New_York", status: { code: "offsale" } }, _embedded: { attractions: [{ id: "verified-id" }], venues: [{ name: "Venue", city: { name: "New York" }, country: { countryCode: "US" } }] } };
const mapping = { artistId: "twice", attractionId: "verified-id", mappingStatus: "verified", verificationEvidence: "https://example.org/review" };
const response = (status, body = {}, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: { get: (name) => headers[name] }, json: async () => body });

test("strict event validation rejects forged artist, URL, unknown date published", () => {
  assert.ok(parseEvent(base, artistIds));
  assert.equal(parseEvent({ ...base, artistId: "unknown" }, artistIds), null);
  assert.equal(parseEvent({ ...base, sourceUrl: "https://twice.jype.com.evil.test/schedule" }, artistIds), null);
  assert.equal(parseEvent({ ...base, timePrecision: "unknown", startAt: null, localDate: null, localTime: null }, artistIds), null);
  assert.equal(parseEvent({ ...base, localDate: "2026-02-30" }, artistIds), null);
});
test("Beijing date handles UTC crossing and IANA DST", () => {
  assert.equal(eventDate(base), "2026-11-01");
  const event = normalizeTicketmaster(tmRaw, mapping, now);
  assert.equal(event.localDate, "2026-10-31");
  assert.equal(eventDate(event), "2026-11-01");
  assert.equal(event.lifecycle, "scheduled"); // offsale is ticket availability, not cancellation
});
test("Ticketmaster identity requires attraction ID in event", () => {
  assert.equal(normalizeTicketmaster({ ...tmRaw, _embedded: { attractions: [{ id: "other" }] } }, mapping, now), null);
  assert.equal(normalizeTicketmaster(tmRaw, { ...mapping, attractionId: "other" }, now), null);
});
test("Ticketmaster cancellation and date-only remain distinct", () => {
  const cancelled = normalizeTicketmaster({ ...tmRaw, dates: { ...tmRaw.dates, status: { code: "canceled" } } }, mapping, now);
  assert.equal(cancelled.lifecycle, "cancelled");
  const dateOnly = normalizeTicketmaster({ ...tmRaw, dates: { ...tmRaw.dates, start: { localDate: "2026-10-31", timeTBA: true } } }, mapping, now);
  assert.equal(dateOnly.timePrecision, "date");
  assert.equal(dateOnly.startAt, null);
  assert.equal(eventDate(dateOnly), "2026-10-31");
});
test("explicit future public onsale becomes a distinct event, never the concert date", () => {
  const source = { ...tmRaw, sales: { public: { startDateTime: "2026-10-20T12:00:00Z" } } };
  const sale = normalizeTicketSale(source, mapping, now);
  assert.equal(sale.id, "tm-sale-G5test");
  assert.equal(sale.eventType, "ticket-sale");
  assert.equal(sale.startAt, "2026-10-20T12:00:00Z");
  assert.notEqual(sale.startAt, normalizeTicketmaster(source, mapping, now).startAt);
  assert.equal(normalizeTicketSale({ ...source, sales: { public: { startTBD: true, startDateTime: "2026-10-20T12:00:00Z" } } }, mapping, now), null);
});
test("repeat and changed sync preserve ID, increase sequence only on change", () => {
  const same = reconcile([base], [{ ...base, firstSeenAt: "2026-10-16T00:00:00Z" }], now);
  assert.equal(same[0].sequence, 0);
  assert.equal(same[0].firstSeenAt, now);
  const changed = reconcile([base], [{ ...base, startAt: "2026-11-01T01:30:00Z", localTime: "09:30", lifecycle: "rescheduled" }], "2026-10-16T00:00:00Z");
  assert.equal(changed[0].id, base.id);
  assert.equal(changed[0].sequence, 1);
});
test("same title is never used for deduplication", () => {
  const other = { ...base, id: "manual-b", sourceEventId: "b", localDate: "2026-11-02", startAt: "2026-11-02T00:30:00Z" };
  assert.equal(reconcile([base], [other], now).length, 2);
});
test("unexpected lifecycle reversal is held for review", () => {
  assert.equal(transitionAllowed("scheduled", "cancelled"), true);
  assert.equal(transitionAllowed("cancelled", "scheduled"), false);
  const prior = { ...base, lifecycle: "cancelled" };
  const next = reconcile([prior], [{ ...base, lifecycle: "scheduled" }], "2026-10-16T00:00:00Z")[0];
  assert.equal(next.verification, "pending-review");
  assert.equal(next.published, false);
});
test("cross-source likeness creates review candidates, not merged records", () => {
  const other = { ...base, id: "tm-G5test", source: "ticketmaster", sourceEventId: "G5test", sourceUrl: "https://www.ticketmaster.com/event/G5test" };
  assert.deepEqual(possibleEventLinks([base, other]), [[base.id, other.id]]);
  assert.equal(reconcile([base], [other], now).length, 2);
});
test("invalid snapshot and unpublished event are rejected", () => {
  assert.equal(parseSnapshot({ schemaVersion: 1, generatedAt: null, sourceStatus: { ticketmaster: "blocked", manual: "ready" }, events: [base, base] }, artistIds), null);
  assert.equal(publishable({ ...base, published: false }), false);
  assert.equal(publishable({ ...base, source: "youtube" }), false);
});
test("failed source preserves valid data, hides after 7 days, deletes after 30", () => {
  const event = { ...base, id: "tm-G5test", source: "ticketmaster", sourceEventId: "G5test", sourceUrl: "https://www.ticketmaster.com/event/G5test" };
  const ids = new Set();
  assert.equal(retainCalendarEvents([event], ids, ids, "2026-10-16T00:00:00Z")[0].published, true);
  assert.equal(retainCalendarEvents([event], ids, ids, "2026-10-23T00:00:00Z")[0].published, false);
  assert.equal(retainCalendarEvents([event], ids, ids, "2026-11-15T00:00:00Z").length, 0);
  assert.equal(currentlyPublishable(event, "2026-10-22T00:00:00Z"), false);
});
test("ICS escapes, folds, uses stable UID and exclusive all-day end", () => {
  const allDay = { ...base, timePrecision: "date", localDate: "2026-11-01", startAt: null, localTime: null, title: "Hello, world; line\nnext" };
  const ics = calendarIcs([allDay], now);
  assert.match(ics, /UID:manual-a@seoul-os/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261101/);
  assert.match(ics, /DTEND;VALUE=DATE:20261102/);
  assert.match(ics, /SUMMARY:Hello\\, world\\; line\\nnext/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
});
test("ICS exports cancellation state and excludes YouTube mixed data", () => {
  const ics = calendarIcs([{ ...base, lifecycle: "cancelled", sequence: 2 }, { ...base, source: "youtube", id: "yt-abcdefghijk" }], now);
  assert.match(ics, /STATUS:CANCELLED/);
  assert.match(ics, /SEQUENCE:2/);
  assert.doesNotMatch(ics, /yt-abcdefghijk/);
});
test("Ticketmaster missing key and 401 are sanitized", async () => {
  await assert.rejects(tmGet("events", {}, ""), /missing/);
  await assert.rejects(tmGet("events", {}, "secret", { fetchImpl: async () => response(401) }), /authorization failed \(401\)/);
});
test("Ticketmaster 429 finite retry and no URL leak", async () => {
  let calls = 0;
  await assert.rejects(tmGet("events", {}, "secret", { fetchImpl: async () => { calls++; return response(429); }, sleep: async () => {} }), (error) => !error.message.includes("secret") && /429/.test(error.message));
  assert.equal(calls, 3);
});
test("Ticketmaster retries 500 but invalid JSON fails cleanly", async () => {
  let calls = 0;
  await assert.rejects(tmGet("events", {}, "secret", { fetchImpl: async () => { calls++; return response(500); }, sleep: async () => {} }), /server error/);
  assert.equal(calls, 3);
  await assert.rejects(tmGet("events", {}, "secret", { fetchImpl: async () => ({ status: 200, ok: true, json: async () => { throw new Error("secret URL"); } }) }), /not JSON/);
});
test("Ticketmaster pagination and duplicate source ID", async () => {
  let calls = 0;
  const result = await discoverEvents(mapping, "secret", { now, sleep: async () => {}, fetchImpl: async () => { calls++; return response(200, { page: { totalPages: 2 }, _embedded: { events: [tmRaw] } }); } });
  assert.equal(calls, 2);
  assert.equal(result.events.length, 1);
  assert.equal(result.requests, 2);
});
test("manual approval requires source and reviewer; draft never publishes", () => {
  const draft = { ...base, id: "a", sourceUrl: "https://twice.jype.com/schedule/123", reviewStatus: "draft" };
  assert.equal(approvedManualEvents({ events: [draft] }, artistIds, now).length, 0);
  assert.throws(() => approvedManualEvents({ events: [{ ...draft, reviewStatus: "approved" }] }, artistIds, now), /evidence/);
  const approved = { ...draft, reviewStatus: "approved", sourceEventId: "a", reviewedBy: "maintainer", evidenceUrl: draft.sourceUrl, reviewedAt: now };
  assert.equal(approvedManualEvents({ events: [approved] }, artistIds, now).length, 1);
});
test("manual CLI stages draft and only reviewed exact official URL can publish", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seoul-calendar-"));
  const path = pathToFileURL(join(dir, "manual.json"));
  try {
    await writeFile(path, JSON.stringify({ schemaVersion: 1, events: [] }));
    assert.equal(verifiedManualSource("day6", "https://twice.jype.com/schedule"), false);
    const id = await addDraft({ artistId: "twice", title: "Test only", eventType: "concert", localDate: "2026-11-01", sourceUrl: "https://twice.jype.com/schedule/123" }, artistIds, path);
    let body = JSON.parse(await readFile(path, "utf8"));
    assert.equal(approvedManualEvents(body, artistIds, now).length, 0);
    await reviewDraft(id, "test-reviewer", artistIds, path);
    body = JSON.parse(await readFile(path, "utf8"));
    assert.equal(approvedManualEvents(body, artistIds, now).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("YouTube upcoming requires channel, state and scheduled time", () => {
  const video = { id: "abcdefghijk", snippet: { channelId: "UCtwice", title: "Official live", liveBroadcastContent: "upcoming" }, liveStreamingDetails: { scheduledStartTime: "2026-11-01T00:30:00Z" } };
  const channel = { channelId: "UCtwice", artistId: "twice" };
  assert.ok(normalizeUpcomingLive(video, channel, now));
  assert.equal(normalizeUpcomingLive({ ...video, snippet: { ...video.snippet, channelId: "other" } }, channel, now), null);
  assert.equal(normalizeUpcomingLive({ ...video, snippet: { ...video.snippet, liveBroadcastContent: "none" } }, channel, now), null);
  assert.equal(normalizeUpcomingLive({ ...video, liveStreamingDetails: {} }, channel, now), null);
});
test("URL allowlist prevents host impersonation", () => {
  assert.equal(safeEventUrl("https://ticketmaster.com.evil.test/a", "ticketmaster"), false);
  assert.equal(safeEventUrl("javascript:alert(1)", "manual-official"), false);
  assert.equal(safeEventUrl("https://www.youtube.com/watch?v=abcdefghijk", "youtube"), true);
});
