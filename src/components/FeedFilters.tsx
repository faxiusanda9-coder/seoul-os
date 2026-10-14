import { artists } from "../data/artists";
import { contentTypes } from "../data/feed";
import type { ContentType } from "../types";

export function FeedFilters({
  artist,
  type,
  onArtist,
  onType,
}: {
  artist: string;
  type: "All types" | ContentType;
  onArtist: (value: string) => void;
  onType: (value: "All types" | ContentType) => void;
}) {
  return (
    <div className="feed-filters">
      <label className="select-field">
        <span>Artist</span>
        <select value={artist} onChange={(e) => onArtist(e.target.value)}>
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
          onChange={(e) => onType(e.target.value as "All types" | ContentType)}
        >
          {contentTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
