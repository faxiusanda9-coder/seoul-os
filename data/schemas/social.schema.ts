export type SocialPlatform = "instagram" | "tiktok";
export type SocialAccount = {
  artistId: string;
  platform: SocialPlatform;
  accountUrl: string;
  handle: string;
  verificationStatus: "verified";
  evidenceUrl: string;
  verifiedAt: string;
  evidenceNote: string;
};
export type SocialContent = {
  id: string;
  artistId: string;
  platform: SocialPlatform;
  contentType: "reels" | "video-post" | "post" | "short-video";
  title: string | null;
  description: string | null;
  thumbnail: null;
  publishedAt: string | null;
  sourceUrl: string;
  embedUrl: string;
  officialAccountUrl: string;
  verificationStatus: "manual-verified" | "api-verified" | "account-matched";
  acquisitionMethod: "manual-verified" | "api" | "third-party-api";
  thirdPartyEvidence?: {
    provider: "brightdata-tiktok-posts";
    datasetId: "gd_lu702nij2f790tmv9h";
    snapshotId: string;
    videoId: string;
    authorHandle: string;
    authorProfileUrl: string;
    originalUrl: string;
    rawCreateTime: string;
    accountEvidenceUrl: string;
    checkedAt: string;
  };
  apiEvidence?: {
    provider: "instagram-business-discovery" | "tiktok-display-api";
    mediaId: string;
    accountId: string;
    checkedAt: string;
    mediaProductType?: "REELS" | "FEED";
  };
  fetchedAt: string;
  lastValidatedAt: string;
  availabilityStatus: "available" | "restricted" | "deleted" | "unknown";
  // Legacy availabilityStatus mixed source and embed observations. Do not infer
  // source removal from an embed restriction, or playback from a loaded shell.
  sourceAvailability?: "available" | "unavailable" | "unknown";
  embedAvailability?: "available" | "failed" | "untested" | "restricted";
  evidenceUrl: string;
  evidenceNote: string;
  reviewedBy: string;
};
export type SocialSnapshot = {
  schemaVersion: 1;
  platform: SocialPlatform;
  items: SocialContent[];
};
export function socialAvailability(item: SocialContent) {
  return {
    source:
      item.sourceAvailability ??
      (item.availabilityStatus === "deleted" ? "unavailable" : "unknown"),
    embed:
      item.embedAvailability ??
      (item.availabilityStatus === "restricted" ? "restricted" : "untested"),
  };
}
export const isInstant = (x: unknown): x is string =>
  typeof x === "string" &&
  /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
    x,
  ) &&
  Number.isFinite(Date.parse(x)) &&
  new Date(`${x.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) ===
    x.slice(0, 10);
export function safeHttps(x: unknown): x is string {
  try {
    const u = new URL(String(x));
    return u.protocol === "https:" && !u.username && !u.password && !u.port;
  } catch {
    return false;
  }
}
export function canonicalAccount(
  platform: SocialPlatform,
  value: string,
): string | null {
  try {
    const u = new URL(value);
    if (!safeHttps(value) || u.search || u.hash) return null;
    const host = platform === "instagram" ? "instagram.com" : "tiktok.com";
    const pattern =
      platform === "instagram" ? /^\/([\w.]+)\/?$/ : /^\/@([\w.]+)\/?$/;
    const match = u.pathname.match(pattern);
    return [host, `www.${host}`].includes(u.hostname) && match
      ? `https://www.${host}/${platform === "tiktok" ? "@" : ""}${match[1].toLowerCase()}/`
      : null;
  } catch {
    return null;
  }
}
export function parseSocialAccounts(
  raw: unknown,
  artists: Set<string>,
): SocialAccount[] | null {
  try {
    const r = raw as { schemaVersion?: number; accounts?: SocialAccount[] };
    if (r?.schemaVersion !== 1 || !Array.isArray(r.accounts)) return null;
    const seen = new Set<string>();
    for (const a of r.accounts) {
      if (
        !a ||
        !["instagram", "tiktok"].includes(a.platform) ||
        !artists.has(a.artistId) ||
        a.verificationStatus !== "verified" ||
        canonicalAccount(a.platform, a.accountUrl) !== a.accountUrl ||
        !a.handle ||
        canonicalAccount(
          a.platform,
          `https://www.${a.platform}.com/${a.platform === "tiktok" ? "@" : ""}${a.handle}/`,
        ) !== a.accountUrl ||
        !safeHttps(a.evidenceUrl) ||
        !isInstant(a.verifiedAt) ||
        !a.evidenceNote?.trim() ||
        seen.has(`${a.artistId}:${a.platform}`)
      )
        return null;
      seen.add(`${a.artistId}:${a.platform}`);
    }
    return r.accounts;
  } catch {
    return null;
  }
}
export function socialIdentity(platform: SocialPlatform, value: string) {
  try {
    const u = new URL(value);
    if (
      !safeHttps(value) ||
      u.search ||
      u.hash ||
      u.hostname !== `www.${platform}.com`
    )
      return null;
    const m = u.pathname.match(
      platform === "instagram"
        ? /^\/(p|reel)\/([A-Za-z0-9_-]{5,40})\/$/
        : /^\/@([\w.]+)\/video\/(\d{15,25})$/,
    );
    if (!m) return null;
    return {
      id: `${platform === "instagram" ? "ig" : "tt"}-${m[2]}`,
      embedUrl:
        platform === "instagram"
          ? `${u.href}embed/`
          : `https://www.tiktok.com/player/v1/${m[2]}`,
      handle: platform === "tiktok" ? m[1].toLowerCase() : null,
      kind: m[1],
    };
  } catch {
    return null;
  }
}
export function parseSocialSnapshot(
  raw: unknown,
  platform: SocialPlatform,
  accounts: SocialAccount[],
): SocialSnapshot | null {
  try {
    const r = raw as SocialSnapshot;
    if (
      r?.schemaVersion !== 1 ||
      r.platform !== platform ||
      !Array.isArray(r.items)
    )
      return null;
    const seen = new Set<string>();
    for (const i of r.items) {
      if (!i) return null;
      const identity = socialIdentity(platform, i.sourceUrl);
      const a = accounts.find(
        (a) => a.platform === platform && a.artistId === i.artistId,
      );
      if (
        !identity ||
        !a ||
        i.id !== identity.id ||
        i.embedUrl !== identity.embedUrl ||
        seen.has(i.id) ||
        i.platform !== platform ||
        i.officialAccountUrl !== a.accountUrl ||
        (identity.handle && identity.handle !== a.handle.toLowerCase()) ||
        !(platform === "tiktok"
          ? i.contentType === "short-video"
          : identity.kind === "reel"
            ? i.contentType === "reels"
            : ["post", "video-post"].includes(i.contentType) ||
              (i.apiEvidence?.mediaProductType === "REELS" &&
                i.contentType === "reels")) ||
        !(
          (i.verificationStatus === "manual-verified" &&
            i.acquisitionMethod === "manual-verified") ||
          (i.verificationStatus === "api-verified" &&
            i.acquisitionMethod === "api" &&
            i.apiEvidence) ||
          (platform === "tiktok" &&
            i.verificationStatus === "account-matched" &&
            i.acquisitionMethod === "third-party-api" &&
            i.thirdPartyEvidence &&
            !i.apiEvidence)
        ) ||
        (i.thirdPartyEvidence !== undefined &&
          (platform !== "tiktok" ||
            !i.thirdPartyEvidence ||
            i.thirdPartyEvidence.provider !== "brightdata-tiktok-posts" ||
            i.thirdPartyEvidence.datasetId !== "gd_lu702nij2f790tmv9h" ||
            !/^s(?:d)?_[A-Za-z0-9]{5,80}$/.test(
              i.thirdPartyEvidence.snapshotId,
            ) ||
            i.thirdPartyEvidence.videoId !== identity.id.slice(3) ||
            i.thirdPartyEvidence.authorHandle !== a.handle.toLowerCase() ||
            i.thirdPartyEvidence.authorProfileUrl !== a.accountUrl ||
            i.thirdPartyEvidence.accountEvidenceUrl !== a.evidenceUrl ||
            !safeHttps(i.thirdPartyEvidence.originalUrl) ||
            socialIdentity(
              "tiktok",
              (() => {
                const u = new URL(i.thirdPartyEvidence.originalUrl);
                u.search = "";
                u.hash = "";
                u.pathname = u.pathname.replace(/\/$/, "");
                return u.href;
              })(),
            )?.id !== i.id ||
            socialIdentity(
              "tiktok",
              (() => {
                const u = new URL(i.thirdPartyEvidence.originalUrl);
                u.search = "";
                u.hash = "";
                u.pathname = u.pathname.replace(/\/$/, "");
                return u.href;
              })(),
            )?.handle !== a.handle.toLowerCase() ||
            !isInstant(i.thirdPartyEvidence.rawCreateTime) ||
            !isInstant(i.thirdPartyEvidence.checkedAt) ||
            (i.acquisitionMethod === "third-party-api" &&
              (i.lastValidatedAt !== i.thirdPartyEvidence.checkedAt ||
                i.publishedAt !== i.thirdPartyEvidence.rawCreateTime)))) ||
        (i.apiEvidence !== undefined &&
          (!i.apiEvidence ||
            i.apiEvidence.provider !==
              (platform === "instagram"
                ? "instagram-business-discovery"
                : "tiktok-display-api") ||
            !/^\d{5,40}$/.test(i.apiEvidence.mediaId) ||
            typeof i.apiEvidence.accountId !== "string" ||
            (platform === "instagram"
              ? !/^\d{5,40}$/.test(i.apiEvidence.accountId)
              : i.apiEvidence.accountId !== a.handle.toLowerCase()) ||
            (platform === "tiktok" &&
              i.apiEvidence.mediaId !== identity.id.slice(3)) ||
            !isInstant(i.apiEvidence.checkedAt) ||
            (i.apiEvidence.mediaProductType !== undefined &&
              (platform !== "instagram" ||
                !["REELS", "FEED"].includes(i.apiEvidence.mediaProductType))) ||
            (i.acquisitionMethod === "api" &&
              Date.parse(i.apiEvidence.checkedAt) >
                Date.parse(i.lastValidatedAt)))) ||
        !["available", "restricted", "deleted", "unknown"].includes(
          i.availabilityStatus,
        ) ||
        (i.sourceAvailability !== undefined &&
          !["available", "unavailable", "unknown"].includes(
            i.sourceAvailability,
          )) ||
        (i.embedAvailability !== undefined &&
          !["available", "failed", "untested", "restricted"].includes(
            i.embedAvailability,
          )) ||
        (i.availabilityStatus === "deleted" &&
          i.sourceAvailability !== undefined &&
          i.sourceAvailability !== "unavailable") ||
        !isInstant(i.fetchedAt) ||
        !isInstant(i.lastValidatedAt) ||
        Date.parse(i.lastValidatedAt) < Date.parse(i.fetchedAt) ||
        (i.publishedAt !== null && !isInstant(i.publishedAt)) ||
        ![i.title, i.description].every(
          (v) =>
            v === null ||
            (typeof v === "string" &&
              v.length <= (i.acquisitionMethod === "api" ? 10000 : 2000)),
        ) ||
        i.thumbnail !== null ||
        !safeHttps(i.evidenceUrl) ||
        !i.evidenceNote?.trim() ||
        !i.reviewedBy?.trim()
      )
        return null;
      seen.add(i.id);
    }
    return r;
  } catch {
    return null;
  }
}
