import { artists } from "../data/artists";
import { contentTypes } from "../data/feed";
import type { ContentType } from "../types";
import type { FeedSort } from "../utils/feed";

export function FeedFilters({
  artist,
  type,
  search,
  sort,
  onArtist,
  onType,
  onSearch,
  onSort,
}: {
  artist: string;
  type: "All types" | ContentType;
  search: string;
  sort: FeedSort;
  onArtist: (value: string) => void;
  onType: (value: "All types" | ContentType) => void;
  onSearch: (value: string) => void;
  onSort: (value: FeedSort) => void;
}) {
  return (
    <div className="feed-filters">
      <label className="select-field">
        <span>Artist</span>
        <select
          value={artist}
          onChange={(e) => onArtist(e.target.value)}
          aria-label="按艺人筛选动态"
        >
          <option value="all">All artists</option>
          {artists.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="select-field">
        <span>Content</span>
        <select
          value={type}
          aria-label="按内容类型筛选动态"
          onChange={(e) => onType(e.target.value as "All types" | ContentType)}
        >
          {contentTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="feed-search">
        <span className="sr-only">搜索动态内容</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索艺人或内容"
        />
      </label>
      <label className="select-field sort-field">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as FeedSort)}
          aria-label="按发布时间排序"
        >
          <option value="newest">最新优先</option>
          <option value="oldest">最早优先</option>
        </select>
      </label>
    </div>
  );
}
