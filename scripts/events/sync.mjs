import { readFile, writeFile, rename } from "node:fs/promises";
import { approvedManualEvents, readManual } from "./manual-events.mjs";
import { discoverEvents } from "./ticketmaster-adapter.mjs";
import {
  parseSnapshot,
  reconcile,
  publishable,
  retainCalendarEvents,
} from "../../src/calendar/engine.ts";
import { calendarIcs } from "../../src/calendar/ics.ts";

const path = new URL("../../data/calendar/events.json", import.meta.url);
const icsPath = new URL("../../data/calendar/all.ics", import.meta.url);
const roster = JSON.parse(
  await readFile(
    new URL("../../data/calendar/ticketmaster-artists.json", import.meta.url),
    "utf8",
  ),
);
const channels = JSON.parse(
  await readFile(
    new URL("../../data/youtube/channels.json", import.meta.url),
    "utf8",
  ),
);
const artistIds = new Set(
  channels.channels.filter((item) => item.enabled).map((item) => item.artistId),
);
if (
  roster.schemaVersion !== 1 ||
  roster.artists.length !== artistIds.size ||
  roster.artists.some((item) => !artistIds.has(item.artistId))
)
  throw new Error("Ticketmaster roster does not match artist IDs");
const now = new Date().toISOString();
const previous = parseSnapshot(
  JSON.parse(await readFile(path, "utf8")),
  artistIds,
);
if (!previous)
  throw new Error("Existing calendar snapshot invalid; refusing to overwrite");
const removals = JSON.parse(
  await readFile(
    new URL("../../data/calendar/removals.json", import.meta.url),
    "utf8",
  ),
);
if (removals.schemaVersion !== 1 || !Array.isArray(removals.ids))
  throw new Error("Removal registry invalid");
const removedIds = new Set(removals.ids);
const manualFile = await readManual();
const manual = approvedManualEvents(
  {
    ...manualFile,
    events: manualFile.events.filter(
      (item) => !removedIds.has(`manual-${item.id}`),
    ),
  },
  artistIds,
  now,
);
const incoming = [...manual];
const results = [];
let ticketmaster = process.env.TICKETMASTER_API_KEY ? "ready" : "blocked";
for (const mapping of roster.artists) {
  if (mapping.mappingStatus !== "verified") {
    results.push({
      artistId: mapping.artistId,
      status: "not-matched",
      requests: 0,
    });
    continue;
  }
  if (!process.env.TICKETMASTER_API_KEY) {
    results.push({
      artistId: mapping.artistId,
      status: "blocked",
      requests: 0,
    });
    continue;
  }
  try {
    const result = await discoverEvents(
      mapping,
      process.env.TICKETMASTER_API_KEY,
      { now },
    );
    incoming.push(...result.events);
    results.push({
      artistId: mapping.artistId,
      status: result.status,
      count: result.events.length,
      requests: result.requests,
      truncated: result.truncated ?? false,
    });
  } catch (error) {
    ticketmaster = "failed";
    results.push({
      artistId: mapping.artistId,
      status: "failed",
      reason: error.message,
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 550));
}
if (!roster.artists.some((item) => item.mappingStatus === "verified"))
  ticketmaster = "blocked";
const merged = reconcile(
  previous.events.filter((event) => !removedIds.has(event.id)),
  incoming.filter((event) => !removedIds.has(event.id)),
  now,
);
const incomingIds = new Set(incoming.map((event) => event.id));
const manualIds = new Set(manual.map((event) => event.id));
const events = retainCalendarEvents(merged, incomingIds, manualIds, now);
const next = {
  schemaVersion: 1,
  generatedAt: previous.generatedAt,
  sourceStatus: { ticketmaster, manual: "ready" },
  events,
};
const equivalent = (a, b) =>
  JSON.stringify({ ...a, generatedAt: null }) ===
  JSON.stringify({ ...b, generatedAt: null });
const changed = !equivalent(previous, next);
if (changed) {
  next.generatedAt = now;
  const temp = new URL("../../data/calendar/events.json.tmp", import.meta.url);
  await writeFile(temp, JSON.stringify(next, null, 2) + "\n");
  await rename(temp, path);
  const icsTemp = new URL("../../data/calendar/all.ics.tmp", import.meta.url);
  await writeFile(icsTemp, calendarIcs(events.filter(publishable), now));
  await rename(icsTemp, icsPath);
}
console.log(
  JSON.stringify({
    changed,
    ticketmaster,
    credentialConfigured: Boolean(process.env.TICKETMASTER_API_KEY),
    manual: manual.length,
    published: events.filter(publishable).length,
    results,
  }),
);
if (results.some((item) => item.status === "failed")) process.exitCode = 1;
