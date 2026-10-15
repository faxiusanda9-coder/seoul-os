import { readFile, writeFile } from "node:fs/promises";
import { attractionCandidates } from "./ticketmaster-adapter.mjs";

const registryPath = new URL(
  "../../data/calendar/ticketmaster-artists.json",
  import.meta.url,
);
const registry = JSON.parse(await readFile(registryPath, "utf8"));
if (!process.env.TICKETMASTER_API_KEY) {
  console.log(
    JSON.stringify({
      status: "blocked",
      reason: "TICKETMASTER_API_KEY missing",
      artistsInvestigated: 0,
      rosterSize: registry.artists.length,
    }),
  );
  process.exit(0);
}
const results = [];
for (const artist of registry.artists) {
  try {
    const candidates = await attractionCandidates(
      artist.canonicalName,
      process.env.TICKETMASTER_API_KEY,
    );
    results.push({
      artistId: artist.artistId,
      canonicalName: artist.canonicalName,
      status: "candidates-for-review",
      candidates,
    });
  } catch (error) {
    results.push({
      artistId: artist.artistId,
      status: "failed",
      reason: error.message,
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 550));
}
const output = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  note: "Search candidates are not verified artist identities. Review evidence before setting mappingStatus=verified.",
  results,
};
await writeFile(
  new URL("../../data/calendar/ticketmaster-candidates.json", import.meta.url),
  JSON.stringify(output, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    status: "completed",
    artistsInvestigated: results.length,
    failed: results.filter((item) => item.status === "failed").length,
    candidates: results.reduce(
      (sum, item) => sum + (item.candidates?.length ?? 0),
      0,
    ),
  }),
);
