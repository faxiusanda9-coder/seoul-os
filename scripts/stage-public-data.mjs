import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { parseChannelSnapshot, parseChannelsConfig } from "../data/schemas/content.schema.ts";

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
