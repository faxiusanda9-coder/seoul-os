import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseChannelSnapshot } from "../data/schemas/content.schema.ts";
import { classifyContent } from "../src/utils/contentClassifier.ts";
import { loadChannels } from "./youtube-sync.mjs";

let updated = 0;
for (const channel of (await loadChannels()).filter((item) => item.enabled)) {
  const file = resolve(`data/youtube/${channel.artistId}.json`);
  const raw = await readFile(file, "utf8");
  const snapshot = parseChannelSnapshot(JSON.parse(raw), channel);
  if (!snapshot) throw new Error(`${channel.artistId}: existing snapshot is invalid`);
  const next = {
    ...snapshot,
    schemaVersion: 3,
    items: snapshot.items.map((item) => {
      const { category: _oldCategory, subcategory: _oldSubcategory,
        classification: _oldClassification, ...original } = item;
      return { ...original, ...classifyContent(item.title, item.description) };
    }),
  };
  if (!parseChannelSnapshot(next, channel)) throw new Error(`${channel.artistId}: classified snapshot is invalid`);
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (raw === serialized) continue;
  const temp = `${file}.taxonomy.tmp`;
  await writeFile(temp, serialized);
  await rename(temp, file);
  updated++;
  const counts = Object.entries(Object.groupBy(next.items, (item) => item.category))
    .map(([category, items]) => `${category}=${items.length}`).join(" ");
  console.log(`${channel.artistId}: ${next.items.length} videos; ${counts}`);
}
console.log(`Taxonomy backfill updated ${updated} independent channel snapshots; API requests=0`);
