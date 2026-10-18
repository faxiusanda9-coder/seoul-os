import {
  isInstant,
  type SocialAccount,
  type SocialPlatform,
} from "./social.schema.ts";

export type DiscoverySource = {
  sourceId: string;
  artistId: string;
  platform: SocialPlatform;
  provider: "instagram-business-discovery" | "tiktok-display-api";
  accountUrl: string;
  state: "not-configured" | "auth-required" | "disabled" | "ok" | "failed";
  lastAttemptAt: string;
  lastCompletedAt: string;
  lastSuccessAt: string | null;
  lastContentChangeAt: string | null;
  accountVerifiedAt: string | null;
  newCount: number | null;
  updatedCount: number | null;
  itemCount: number;
  pagesRead: number;
  failedSources: { sourceId: string; error: string }[];
};
export type DiscoveryStatus = { schemaVersion: 1; sources: DiscoverySource[] };
export const discoveryProvider = (platform: SocialPlatform) =>
  platform === "instagram"
    ? "instagram-business-discovery"
    : "tiktok-display-api";

export function parseDiscoveryStatus(
  raw: unknown,
  accounts: SocialAccount[],
): DiscoveryStatus | null {
  try {
    const r = raw as DiscoveryStatus;
    if (r?.schemaVersion !== 1 || !Array.isArray(r.sources)) return null;
    const seen = new Set<string>();
    for (const s of r.sources) {
      if (
        !s ||
        s.sourceId !== `${s.platform}:${s.artistId}` ||
        seen.has(s.sourceId) ||
        !accounts.some(
          (a) =>
            a.artistId === s.artistId &&
            a.platform === s.platform &&
            a.accountUrl === s.accountUrl,
        ) ||
        s.provider !== discoveryProvider(s.platform) ||
        ![
          "not-configured",
          "auth-required",
          "disabled",
          "ok",
          "failed",
        ].includes(s.state) ||
        !isInstant(s.lastAttemptAt) ||
        !isInstant(s.lastCompletedAt) ||
        Date.parse(s.lastCompletedAt) < Date.parse(s.lastAttemptAt) ||
        ![s.lastSuccessAt, s.lastContentChangeAt, s.accountVerifiedAt].every(
          (v) =>
            v === null ||
            (isInstant(v) && Date.parse(v) <= Date.parse(s.lastCompletedAt)),
        ) ||
        ![s.itemCount, s.pagesRead].every(
          (n) => Number.isInteger(n) && n >= 0,
        ) ||
        ![s.newCount, s.updatedCount].every((n) =>
          s.state === "ok" ? Number.isInteger(n) && n! >= 0 : n === null,
        ) ||
        (s.state === "ok" &&
          (!s.lastSuccessAt || !s.accountVerifiedAt || s.pagesRead < 1)) ||
        !Array.isArray(s.failedSources) ||
        s.failedSources.some(
          (f) =>
            f.sourceId !== s.sourceId || !/^[A-Z0-9_ -]{1,100}$/.test(f.error),
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

// Latest scheduled slot that should have completed, with one hour of grace.
// UTC 00/04/12 = Beijing 08/12/20; the overnight gap is twelve hours.
export function latestDueSlot(now: number, graceMs = 60 * 60 * 1000) {
  const cutoff = now - graceMs;
  const day = new Date(cutoff);
  day.setUTCHours(0, 0, 0, 0);
  for (const hour of [12, 4, 0]) {
    const slot = day.getTime() + hour * 3600000;
    if (slot <= cutoff) return slot;
  }
  return day.getTime() - 12 * 3600000;
}
export function discoveryIsStale(source: DiscoverySource, now = Date.now()) {
  return (
    source.state === "ok" &&
    (!source.lastSuccessAt ||
      Date.parse(source.lastSuccessAt) < latestDueSlot(now))
  );
}
