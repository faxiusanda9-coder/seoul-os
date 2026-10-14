import { artistById } from "../data/artists";
import type { FeedItem } from "../types";
import { contentCategoryLabel, contentTypeLabel, translate, type Locale } from "../locales/i18n";
import { contentCategories, type ContentCategory } from "./contentClassifier";

export type FeedSort = "newest" | "oldest";
export type FeedQuery = {
  artist: string;
  category: "all" | ContentCategory;
  search: string;
  sort: FeedSort;
};

/** Localized search terms supplement the untouched official title. */
export function searchableFeedText(item: FeedItem, locale: Locale): string {
  const type = contentTypeLabel(locale, item.type);
  const category = contentCategoryLabel(locale, item.contentCategory);
  const demoTitle =
    item.kind === "demo" ? translate(locale, "demo.feedTitle", { type }) : "";
  const sourceLabel =
    item.kind === "demo"
      ? translate(locale, "common.demoSource")
      : item.kind === "live"
        ? translate(locale, "common.officialYouTube")
        : translate(locale, "common.officialSample");
  return `${item.title} ${item.translationVerified ? (item.localizedTitle ?? "") : ""} ${demoTitle} ${item.type} ${type} ${category} ${sourceLabel} ${item.source} ${artistById(item.artistId)?.name ?? ""}`.toLocaleLowerCase();
}

export function countContentCategories(items: FeedItem[]): Record<ContentCategory, number> {
  const counts = Object.fromEntries(contentCategories.map((category) => [category, 0])) as Record<ContentCategory, number>;
  for (const item of items) counts[item.contentCategory]++;
  return counts;
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
        (query.category === "all" || item.contentCategory === query.category) &&
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
