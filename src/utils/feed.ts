import { artistById } from "../data/artists";
import type { ContentType, FeedItem } from "../types";
import { contentTypeLabel, translate, type Locale } from "../locales/i18n";

export type FeedSort = "newest" | "oldest";
export type FeedQuery = {
  artist: string;
  type: "All types" | ContentType;
  search: string;
  sort: FeedSort;
};

/** Localized search terms supplement the untouched official title. */
export function searchableFeedText(item: FeedItem, locale: Locale): string {
  const type = contentTypeLabel(locale, item.type);
  const demoTitle =
    item.kind === "demo" ? translate(locale, "demo.feedTitle", { type }) : "";
  const sourceLabel =
    item.kind === "demo"
      ? translate(locale, "common.demoSource")
      : item.kind === "live"
        ? translate(locale, "common.officialYouTube")
        : translate(locale, "common.officialSample");
  return `${item.title} ${item.translationVerified ? (item.localizedTitle ?? "") : ""} ${demoTitle} ${item.type} ${type} ${sourceLabel} ${item.source} ${artistById(item.artistId)?.name ?? ""}`.toLocaleLowerCase();
}

export function selectFeed(
  items: FeedItem[],
  query: FeedQuery,
  locale: Locale = "zh-CN",
): FeedItem[] {
  const needle = query.search.trim().toLocaleLowerCase();
  return items
    .filter((item) => {
      const matchesText =
        !needle || searchableFeedText(item, locale).includes(needle);
      return (
        (query.artist === "all" || item.artistId === query.artist) &&
        (query.type === "All types" || item.type === query.type) &&
        matchesText
      );
    })
    .sort((a, b) => {
      if (!a.publishedAt && !b.publishedAt) return 0;
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return query.sort === "newest"
        ? b.publishedAt.localeCompare(a.publishedAt)
        : a.publishedAt.localeCompare(b.publishedAt);
    });
}

export function publishedLabel(item: FeedItem, locale: Locale) {
  if (item.kind === "live" && item.publishedAt)
    return translate(locale, "common.publishedTime", {
      date: new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(item.publishedAt)),
    });
  return item.publishedAt
    ? translate(locale, "common.publishedDate", {
        date: new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${item.publishedAt}T12:00:00Z`)),
      })
    : item.kind === "official"
      ? translate(locale, "common.noVerifiedDate")
      : translate(locale, "common.noDemoDate");
}
