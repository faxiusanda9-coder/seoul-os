import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { parseChannelSnapshot, parseChannelsConfig } from "../data/schemas/content.schema.ts";
import { parseSnapshot, currentlyPublishable } from "../src/calendar/engine.ts";
import { approvedManualEvents, readManual } from "./events/manual-events.mjs";

const publicRoot = resolve("public");
const targetDir = resolve("public/data/youtube");
if (!targetDir.startsWith(`${publicRoot}${sep}`))
  throw new Error("Refusing to stage outside public directory");

const sourceDir = resolve("data/youtube");
const rawConfig = await readFile(resolve(sourceDir, "channels.json"), "utf8");
const config = parseChannelsConfig(JSON.parse(rawConfig));
if (!config) throw new Error("Channel configuration failed validation");

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await writeFile(resolve(targetDir, "channels.json"), rawConfig);

let staged = 0;
for (const channel of config.channels.filter((item) => item.enabled)) {
  let raw;
  try { raw = await readFile(resolve(sourceDir, `${channel.artistId}.json`), "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const snapshot = parseChannelSnapshot(JSON.parse(raw), channel);
  if (!snapshot) {
    console.warn(`${channel.artistId}: invalid snapshot omitted from build`);
    continue;
  }
  if (snapshot.fetchedAt && Date.now() - Date.parse(snapshot.fetchedAt) >= 30 * 24 * 60 * 60 * 1000) {
    console.warn(`${channel.artistId}: expired snapshot omitted from build`);
    continue;
  }
  await writeFile(resolve(targetDir, `${channel.artistId}.json`), raw);
  staged++;
}
console.log(`Staged ${staged} independent channel snapshots`);

const rosterIds = new Set(config.channels.filter((item) => item.enabled).map((item) => item.artistId));
const calendar = parseSnapshot(JSON.parse(await readFile(resolve("data/calendar/events.json"), "utf8")), rosterIds);
if (!calendar) throw new Error("Calendar snapshot failed validation");
const removals = JSON.parse(await readFile(resolve("data/calendar/removals.json"), "utf8"));
if (removals.schemaVersion !== 1 || !Array.isArray(removals.ids)) throw new Error("Calendar removal registry failed validation");
const removed = new Set(removals.ids);
const manualFile = await readManual();
const approvedManual = new Map(approvedManualEvents({ ...manualFile, events: manualFile.events.filter((item) => !removed.has(`manual-${item.id}`)) }, rosterIds, new Date().toISOString()).map((event) => [event.id, event]));
const tmRegistry = JSON.parse(await readFile(resolve("data/calendar/ticketmaster-artists.json"), "utf8"));
if (tmRegistry.schemaVersion !== 1 || !Array.isArray(tmRegistry.artists)) throw new Error("Ticketmaster identity registry invalid");
const verifiedTmArtists = new Set(tmRegistry.artists.filter((item) => item.mappingStatus === "verified" && item.attractionId && item.verificationEvidence).map((item) => item.artistId));
const calendarTarget = resolve("public/data/calendar");
await rm(calendarTarget, { recursive: true, force: true });
await mkdir(calendarTarget, { recursive: true });
const publicCalendar = { ...calendar, events: calendar.events.filter((event) => {
  if (!currentlyPublishable(event, new Date().toISOString()) || removed.has(event.id)) return false;
  if (event.source === "ticketmaster") return verifiedTmArtists.has(event.artistId);
  if (event.source === "manual-official") {
    const approved = approvedManual.get(event.id);
    return !!approved && ["title", "artistId", "sourceUrl", "localDate", "startAt", "lifecycle"].every((key) => approved[key] === event[key]);
  }
  return false;
}) };
await writeFile(resolve(calendarTarget, "events.json"), JSON.stringify(publicCalendar, null, 2) + "\n");
const { calendarIcs } = await import("../src/calendar/ics.ts");
await writeFile(resolve(calendarTarget, "all.ics"), calendarIcs(publicCalendar.events, calendar.generatedAt ?? new Date(0).toISOString()));
console.log(`Staged ${publicCalendar.events.length} verified calendar events`);
