import { ArrowUpRight, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { artistById } from "../data/artists";
import { useArchive } from "../store/ArchiveContext";
import type { FeedItem } from "../types";
import { ArtistArt } from "./ArtistArt";

export function FeedCard({
  item,
  compact = false,
}: {
  item: FeedItem;
  compact?: boolean;
}) {
  const artist = artistById(item.artistId)!;
  const { isSaved, toggleSaved } = useArchive();
  const active = isSaved(item.id);
  return (
    <article className={`feed-card ${compact ? "feed-card--compact" : ""}`}>
      <div className="feed-thumb">
        <ArtistArt artist={artist} variant="mini" />
      </div>
      <div className="feed-body">
        <div className="feed-meta">
          <Link to={`/artists/${artist.id}`}>{artist.name}</Link>
          <span className="meta-dot" />
          {item.type}
        </div>
        <h3>{item.title}</h3>
        <p>
          {item.source} <span className="meta-dot" /> 演示内容 · 无真实发布时间
        </p>
      </div>
      <div className="feed-actions">
        <button
          className={`icon-button ${active ? "is-active" : ""}`}
          type="button"
          aria-label={active ? `取消收藏 ${item.title}` : `收藏 ${item.title}`}
          aria-pressed={active}
          onClick={() => toggleSaved(item.id, item.category)}
        >
          <Bookmark size={19} fill={active ? "currentColor" : "none"} />
        </button>
        <a
          className="icon-button"
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`打开 ${item.source} 官方频道，新窗口`}
          title="打开官方频道（演示条目无对应真实内容）"
        >
          <ArrowUpRight size={19} />
        </a>
      </div>
    </article>
  );
}
