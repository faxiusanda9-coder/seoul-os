import { artistById } from "../data/artists";
import type { ContentType, FeedItem } from "../types";

export type FeedSort = "newest" | "oldest";
export type FeedQuery = {
  artist: string;
  type: "All types" | ContentType;
  search: string;
  sort: FeedSort;
};

export function selectFeed(items: FeedItem[], query: FeedQuery): FeedItem[] {
  const needle = query.search.trim().toLocaleLowerCase();
  return items
    .filter((item) => {
      const matchesText =
        !needle ||
        `${item.title} ${item.type} ${item.source} ${artistById(item.artistId)?.name ?? ""}`
          .toLocaleLowerCase()
          .includes(needle);
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

export function publishedLabel(item: FeedItem) {
  return item.publishedAt
    ? `发布 ${item.publishedAt.replaceAll("-", ".")}（日期）`
    : item.kind === "official"
      ? "官方视频 · 发布时间未核实"
      : "演示内容 · 无真实发布时间";
}
