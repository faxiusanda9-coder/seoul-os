import type { ChannelConfig } from "../../data/schemas/content.schema";
import { contentTypes } from "../data/feed";
import type { ContentType } from "../types";
import type { FeedSort } from "../utils/feed";
import { contentTypeLabel, useI18n } from "../locales/i18n";

export function FeedFilters({
  artist,
  channels,
  type,
  search,
  sort,
  onArtist,
  onType,
  onSearch,
  onSort,
}: {
  artist: string;
  channels: ChannelConfig[];
  type: "All types" | ContentType;
  search: string;
  sort: FeedSort;
  onArtist: (value: string) => void;
  onType: (value: "All types" | ContentType) => void;
  onSearch: (value: string) => void;
  onSort: (value: FeedSort) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="feed-filters">
      <label className="select-field">
        <span>{t("discover.filterArtist")}</span>
        <select
          value={artist}
          onChange={(e) => onArtist(e.target.value)}
          aria-label={t("discover.filterArtist")}
        >
          {channels.map((item) => (
            <option value={item.artistId} key={item.artistId}>
              {item.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="select-field">
        <span>{t("discover.filterContent")}</span>
        <select
          value={type}
          aria-label={t("discover.filterContent")}
          onChange={(e) => onType(e.target.value as "All types" | ContentType)}
        >
          {contentTypes.map((item) => (
            <option key={item} value={item}>
              {item === "All types"
                ? t("discover.allTypes")
                : contentTypeLabel(locale, item)}
            </option>
          ))}
        </select>
      </label>
      <label className="feed-search">
        <span className="sr-only">{t("search.input")}</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("discover.searchPlaceholder")}
        />
      </label>
      <label className="select-field sort-field">
        <span>{t("discover.sort")}</span>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as FeedSort)}
          aria-label={t("discover.sort")}
        >
          <option value="newest">{t("discover.sortNewest")}</option>
          <option value="oldest">{t("discover.sortOldest")}</option>
        </select>
      </label>
    </div>
  );
}
