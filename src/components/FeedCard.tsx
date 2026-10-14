import { ArrowUpRight, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { artistById } from "../data/artists";
import { useArchive } from "../store/ArchiveContext";
import type { FeedItem } from "../types";
import { publishedLabel } from "../utils/feed";
import { visualVideoForItem } from "../utils/media";
import { FeedThumbnail } from "./FeedThumbnail";

export function FeedCard({
  item,
  compact = false,
}: {
  item: FeedItem;
  compact?: boolean;
}) {
  const artist = artistById(item.artistId);
  const { isSaved, toggleSaved } = useArchive();
  if (!artist) return null;
  const active = isSaved(item.id);
  const visual = visualVideoForItem(item);
  return (
    <article className={`feed-card ${compact ? "feed-card--compact" : ""}`}>
      <a
        className="feed-image-link"
        href={visual?.sourceUrl ?? item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={
          item.kind !== "demo"
            ? `观看 ${item.title} 官方视频，新窗口`
            : `观看 ${artist.name} 封面参考的官方视频，新窗口；非本条演示内容`
        }
      >
        <FeedThumbnail item={item} />
      </a>
      <div className="feed-body">
        <div className="feed-meta">
          <Link to={`/artists/${artist.id}`}>{artist.name}</Link>
          <span className="meta-dot" aria-hidden="true" />
          <span>{item.type}</span>
          <span
            className={`feed-kind ${item.kind === "demo" ? "feed-kind--demo" : ""}`}
          >
            {item.kind === "live"
              ? "Official YouTube Source"
              : item.kind === "official"
                ? "精选官方视频"
                : "DEMO"}
          </span>
        </div>
        <h3>{item.title}</h3>
        <div className="feed-source-time">
          <span>{item.source}</span>
          {item.publishedAt ? (
            <time dateTime={item.publishedAt}>{publishedLabel(item)}</time>
          ) : (
            <span>{publishedLabel(item)}</span>
          )}
        </div>
        {item.kind === "demo" && visual && (
          <p className="reference-credit">
            封面参考：{visual.title} · 非本条演示内容
          </p>
        )}
      </div>
      <div className="feed-actions">
        <button
          className={`icon-button ${active ? "is-active" : ""}`}
          type="button"
          aria-label={active ? `取消收藏 ${item.title}` : `收藏 ${item.title}`}
          aria-pressed={active}
          title={active ? "取消收藏" : "收藏"}
          onClick={() => toggleSaved(item.id, item.category)}
        >
          <Bookmark size={20} fill={active ? "currentColor" : "none"} />
        </button>
        <a
          className="icon-button"
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={
            item.kind !== "demo"
              ? `打开 ${item.title} 官方视频，新窗口`
              : "打开 JYP 官方频道，新窗口（演示条目无对应视频）"
          }
          title={
            item.kind !== "demo" ? "观看官方视频" : "打开官方频道（演示条目）"
          }
        >
          <ArrowUpRight size={20} />
        </a>
      </div>
    </article>
  );
}
