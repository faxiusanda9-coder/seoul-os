import type { NoticeCategory, OfficialEvent, OfficialNotice } from "../types/official";
import { isAllowedOfficialContentUrl } from "../data/officialSources.ts";

/** SEOUL.OS semantic tag for future licensed notice metadata, not the website's source type. */
export function classifyOfficialNotice(title: string): NoticeCategory {
  const value = title.normalize("NFKC").toLowerCase();
  if (/tour[ -]?log|투어로그|巡演花絮/.test(value)) return "media";
  if (/birthday|생일|誕生日|生日|anniversary|기념일|周年/.test(value)) return "anniversary";
  if (/teaser|티저|予告|预告|concept photo|highlight medley/.test(value)) return "teaser";
  if (/ticket|ticketing|티켓|예매|售票|抽選|先行予約/.test(value)) return "ticket";
  if (/pre[ -]?order|pre[ -]?sale|예약 판매|予約販売|预售|merch|goods|グッズ|굿즈/.test(value)) return "merchandise";
  if (/fan[ -]?meeting|fan event|팬미팅|팬 이벤트|粉丝活动/.test(value)) return "fan-event";
  if (/concert|world tour|콘서트|공연|演唱会/.test(value)) return "concert";
  if (/music video|\bm\/?v\b|video update|영상|動画|special clip/.test(value)) return "media";
  if (/album release|single release|released online|album out now|발매 안내|发行|配信リリース/.test(value)) return "release";
  if (/comeback|컴백|回归/.test(value)) return "comeback";
  if (/^\s*\[(?:notice|공지|お知らせ|公告)\]|^\s*official announcement|서비스 점검|개인정보처리방침/.test(value)) return "official-notice";
  return "other";
}

export function isValidOfficialDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidOfficialEvent(event: OfficialEvent): boolean {
  if (!event.id || !event.artistId || !event.title.trim()) return false;
  if (!isAllowedOfficialContentUrl(event.sourceUrl)) return false;
  if (event.localDate && !isValidOfficialDateOnly(event.localDate)) return false;
  if (!event.startAt && !event.localDate) return false;
  if (!event.startAt && event.timeConfirmed) return false;
  if (event.startAt && Number.isNaN(Date.parse(event.startAt))) return false;
  return true;
}

export function isValidOfficialNotice(notice: OfficialNotice): boolean {
  return !!notice.id && !!notice.artistId && !!notice.sourceId &&
    !!notice.originalTitle.trim() && notice.sourceType === "jyp-official" &&
    isAllowedOfficialContentUrl(notice.sourceUrl) &&
    (notice.publishedAt === null ||
      (notice.publishedDatePrecision === "date" && isValidOfficialDateOnly(notice.publishedAt)) ||
      (notice.publishedDatePrecision === "datetime" && !Number.isNaN(Date.parse(notice.publishedAt))));
}
