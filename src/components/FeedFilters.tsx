import type { ChannelConfig } from "../../data/schemas/content.schema";
import type { ContentCategory } from "../utils/contentClassifier";
import type { FeedSort } from "../utils/feed";
import { useI18n } from "../locales/i18n";
import { ContentCategorySelect } from "./ContentCategorySelect";

export function FeedFilters({
  artist,
  channels,
  category,
  categoryCounts,
  categoryTotal,
  search,
  sort,
  onArtist,
  onCategory,
  onSearch,
  onSort,
}: {
  artist: string;
  channels: ChannelConfig[];
  category: "all" | ContentCategory;
  categoryCounts: Record<ContentCategory, number>;
  categoryTotal: number;
  search: string;
  sort: FeedSort;
  onArtist: (value: string) => void;
  onCategory: (value: "all" | ContentCategory) => void;
  onSearch: (value: string) => void;
  onSort: (value: FeedSort) => void;
}) {
  const { t } = useI18n();
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
      <ContentCategorySelect value={category} counts={categoryCounts}
        total={categoryTotal} onChange={onCategory} />
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
