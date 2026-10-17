import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { parseSyncStatus } from "../data/schemas/sync-status.schema.ts";
export async function atomicJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n");
  await rename(temp, file);
}
export async function readStatus(file) {
  try {
    const value = parseSyncStatus(JSON.parse(await readFile(file, "utf8")));
    if (!value) throw new Error("Invalid sync status");
    return value;
  } catch (e) {
    if (e.code === "ENOENT") return { schemaVersion: 1, sources: [] };
    throw e;
  }
}
export async function updateStatus(file, entry) {
  const current = await readStatus(file);
  current.sources = [
    ...current.sources.filter((s) => s.sourceId !== entry.sourceId),
    entry,
  ].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  if (!parseSyncStatus(current))
    throw new Error("Generated sync status failed validation");
  await atomicJson(file, current);
}
export function safeError(error) {
  const msg = String(error?.message ?? "");
  if (/missing/i.test(msg)) return "Missing API credentials";
  if (/quota/i.test(msg)) return "API quota exceeded";
  if (/HTTP \d{3}/.test(msg)) return msg.match(/HTTP \d{3}/)[0];
  if (/identity|match/i.test(msg)) return "Official source identity mismatch";
  if (/network|timeout/i.test(msg)) return "Source request failed or timed out";
  return "Source validation or synchronization failed; inspect workflow logs";
}
