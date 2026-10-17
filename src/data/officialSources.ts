import type { OfficialSource } from "../types/official";

const checked = "2026-10-15";
const jypReason = "官网公开入口已核实；未发现允许定时采集、缓存和转载的明确授权，且 robots.txt 排除 /api/。";
const jypBasis = "JYP 官网自身导航链接；仅提供跳转，不复制页面内容。";
const jypArtist = (artistId: string, origin: string): OfficialSource => ({
  artistId,
  noticeUrl: `${origin}/notice`,
  scheduleUrl: `${origin}/schedule`,
  releaseUrl: `${origin}/discography`,
  sourceType: "jyp-site",
  authorizationBasis: jypBasis,
  accessStatus: "public",
  dataAvailability: "notice-and-schedule",
  automationAllowed: false,
  lastCheckedAt: checked,
  reason: jypReason,
  evidenceUrl: origin,
});

/** Only links followed from the official JYP/artist navigation are published here. */
export const officialSources: OfficialSource[] = [
  {
    artistId: "jyp-company",
    noticeUrl: "https://www.jype.com/ko/board/notice",
    sourceType: "jyp-site",
    authorizationBasis: jypBasis,
    accessStatus: "public",
    dataAvailability: "notice-only",
    automationAllowed: false,
    lastCheckedAt: checked,
    reason: jypReason,
    evidenceUrl: "https://www.jype.com/ko/board/notice",
  },
  jypArtist("twice", "https://twice.jype.com"),
  jypArtist("stray-kids", "https://straykids.jype.com"),
  jypArtist("itzy", "https://itzy.jype.com"),
  jypArtist("nmixx", "https://nmixx.jype.com"),
  jypArtist("day6", "https://day6.jype.com"),
  jypArtist("xdinary-heroes", "https://xdinaryheroes.jype.com"),
  jypArtist("kickflip", "https://kickflip.jype.com"),
  jypArtist("nexz", "https://nexz.jype.com"),
  {
    artistId: "niziu",
    noticeUrl: "https://niziu.com/s/n123/page/news",
    sourceType: "artist-site",
    authorizationBasis: "NiziU 官网导航中的 NEWS 链接；仅提供跳转。",
    accessStatus: "public",
    dataAvailability: "notice-only",
    automationAllowed: false,
    lastCheckedAt: checked,
    reason: "官网提供公开 NEWS 和 LIVE 页面，但未找到可自动同步与转载的明确许可；LIVE 是专题入口，非统一 Schedule 数据源。",
    evidenceUrl: "https://niziu.com/",
  },
];

export const sourceForArtist = (artistId: string) =>
  officialSources.find((source) => source.artistId === artistId);

export function isVerifiedOfficialSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && officialSources.some((source) =>
      [source.noticeUrl, source.scheduleUrl].includes(url.href));
  } catch { return false; }
}

/** Future adapters may only emit detail URLs below a verified notice/schedule root. */
export function isAllowedOfficialContentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return officialSources.some((source) =>
      [source.noticeUrl, source.scheduleUrl].filter(Boolean).some((root) => {
        const allowed = new URL(root!);
        return url.hostname === allowed.hostname && url.port === allowed.port &&
          (url.pathname === allowed.pathname || url.pathname.startsWith(`${allowed.pathname}/`));
      }));
  } catch { return false; }
}
