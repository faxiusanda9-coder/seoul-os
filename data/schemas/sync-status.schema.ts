import { isInstant } from "./social.schema.ts";
export type SourceStatus = {
  sourceId: string;
  artistId: string;
  platform: "youtube" | "instagram" | "tiktok";
  mode: "api" | "manual-validation";
  status: "ok" | "failed" | "skipped" | "running";
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  lastContentChangeAt: string | null;
  newCount: number;
  updatedCount: number;
  itemCount: number;
  failedSources: { sourceId: string; error: string }[];
};
export type SyncStatus = { schemaVersion: 1; sources: SourceStatus[] };
export function parseSyncStatus(raw: unknown): SyncStatus | null {
  try {
    const r = raw as SyncStatus;
    if (r?.schemaVersion !== 1 || !Array.isArray(r.sources)) return null;
    const seen = new Set<string>();
    for (const s of r.sources) {
      if (
        !s ||
        !["youtube", "instagram", "tiktok"].includes(s.platform) ||
        !/^[a-z0-9-]+$/.test(s.artistId) ||
        s.sourceId !== `${s.platform}:${s.artistId}` ||
        seen.has(s.sourceId) ||
        s.mode !== (s.platform === "youtube" ? "api" : "manual-validation") ||
        !["ok", "failed", "skipped", "running"].includes(s.status) ||
        !isInstant(s.lastAttemptAt) ||
        ![s.lastSuccessAt, s.lastContentChangeAt].every(
          (v) =>
            v === null ||
            (isInstant(v) && Date.parse(v) <= Date.parse(s.lastAttemptAt)),
        ) ||
        ![s.newCount, s.updatedCount, s.itemCount].every(
          (n) => Number.isInteger(n) && n >= 0,
        ) ||
        !Array.isArray(s.failedSources) ||
        s.failedSources.some(
          (f) =>
            f.sourceId !== s.sourceId ||
            typeof f.error !== "string" ||
            !f.error ||
            f.error.length > 240,
        )
      )
        return null;
      seen.add(s.sourceId);
    }
    return r;
  } catch {
    return null;
  }
}
