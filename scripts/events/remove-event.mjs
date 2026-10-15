import { readFile, writeFile, rename } from "node:fs/promises";
import { calendarIcs } from "../../src/calendar/ics.ts";
import { publishable } from "../../src/calendar/engine.ts";

const id = process.argv.find((arg) => arg.startsWith("--id="))?.slice(5);
if (!/^(tm|yt|manual)-[A-Za-z0-9_-]{1,110}$/.test(id ?? ""))
  throw new Error("Usage: npm run event:remove -- --id=tm-...");
const removalPath = new URL(
  "../../data/calendar/removals.json",
  import.meta.url,
);
const eventsPath = new URL("../../data/calendar/events.json", import.meta.url);
const icsPath = new URL("../../data/calendar/all.ics", import.meta.url);
const removals = JSON.parse(await readFile(removalPath, "utf8"));
const snapshot = JSON.parse(await readFile(eventsPath, "utf8"));
if (
  removals.schemaVersion !== 1 ||
  !Array.isArray(removals.ids) ||
  snapshot.schemaVersion !== 1 ||
  !Array.isArray(snapshot.events)
)
  throw new Error("Calendar data invalid");
const now = new Date().toISOString();
if (!removals.ids.includes(id)) removals.ids.push(id);
snapshot.events = snapshot.events.filter((event) => event.id !== id);
snapshot.generatedAt = now;
await writeFile(
  new URL("../../data/calendar/removals.json.tmp", import.meta.url),
  JSON.stringify(removals, null, 2) + "\n",
);
await rename(
  new URL("../../data/calendar/removals.json.tmp", import.meta.url),
  removalPath,
);
await writeFile(
  new URL("../../data/calendar/events.json.tmp", import.meta.url),
  JSON.stringify(snapshot, null, 2) + "\n",
);
await rename(
  new URL("../../data/calendar/events.json.tmp", import.meta.url),
  eventsPath,
);
await writeFile(
  new URL("../../data/calendar/all.ics.tmp", import.meta.url),
  calendarIcs(snapshot.events.filter(publishable), now),
);
await rename(
  new URL("../../data/calendar/all.ics.tmp", import.meta.url),
  icsPath,
);
console.log(`Removed ${id} from calendar and ICS; commit and deploy promptly.`);
