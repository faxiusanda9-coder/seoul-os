import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseContentSnapshot } from "../data/schemas/content.schema.ts";

const source = resolve("data/youtube/twice.json");
const target = resolve("public/data/youtube/twice.json");
const raw = await readFile(source, "utf8");
if (!parseContentSnapshot(JSON.parse(raw)))
  throw new Error("TWICE snapshot failed validation");
await mkdir(resolve("public/data/youtube"), { recursive: true });
await writeFile(target, raw);
console.log("Staged TWICE JSON for Vite public assets");
