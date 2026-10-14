import { ArrowUpRight, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { artistById } from "../data/artists";
import { useArchive } from "../store/ArchiveContext";
import type { FeedItem } from "../types";
import { publishedLabel } from "../utils/feed";
import { visualVideoForItem } from "../utils/media";
import { FeedThumbnail } from "./FeedThumbnail";
import { contentTypeLabel, useI18n } from "../locales/i18n";

export function FeedCard({
  item,
  compact = false,
}: {
  item: FeedItem;
  compact?: boolean;
}) {
  const artist = artistById(item.artistId);
  const { isSaved, toggleSaved } = useArchive();
  const { t, locale } = useI18n();
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
            ? t("common.watchOfficial", { title: item.title })
            : t("common.watchReference", { artist: artist.name })
        }
      >
        <FeedThumbnail item={item} />
      </a>
      <div className="feed-body">
        <div className="feed-meta">
          <Link to={`/artists/${artist.id}`}>{artist.name}</Link>
          <span className="meta-dot" aria-hidden="true" />
          <span>{contentTypeLabel(locale, item.type)}</span>
          <span
            className={`feed-kind ${item.kind === "demo" ? "feed-kind--demo" : ""}`}
          >
            {item.kind === "live"
              ? t("common.officialYouTube", { artist: artist.name })
              : item.kind === "official"
                ? t("common.officialSample")
                : t("common.demo")}
          </span>
        </div>
        <h3>
          {item.kind === "demo"
            ? t("demo.feedTitle", { type: contentTypeLabel(locale, item.type) })
            : item.title}
        </h3>
        {locale === "zh-CN" &&
          item.translationVerified &&
          item.localizedTitle && (
            <p className="feed-local-title">{item.localizedTitle}</p>
          )}
        <div className="feed-source-time">
          <span>
            {item.kind === "demo"
              ? t("common.demoSource")
              : item.kind === "official"
                ? t("common.sampleSource")
                : item.source}
          </span>
          {item.publishedAt ? (
            <time dateTime={item.publishedAt}>
              {publishedLabel(item, locale)}
            </time>
          ) : (
            <span>{publishedLabel(item, locale)}</span>
          )}
        </div>
        {item.kind === "demo" && visual && (
          <p className="reference-credit">
            {t("common.coverReference", { title: visual.title })}
          </p>
        )}
      </div>
      <div className="feed-actions">
        <button
          className={`icon-button ${active ? "is-active" : ""}`}
          type="button"
          aria-label={
            active
              ? t("common.removeBookmark", { title: item.title })
              : t("common.bookmark", { title: item.title })
          }
          aria-pressed={active}
          title={
            active ? t("common.removeBookmarkShort") : t("common.bookmarkShort")
          }
          onClick={() => toggleSaved(item.id, item.category, item.artistId)}
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
              ? t("common.openOfficial", { title: item.title })
              : t("common.openDemoChannel")
          }
          title={
            item.kind !== "demo"
              ? t("common.watchVideo")
              : t("common.openDemoChannelShort")
          }
        >
          <ArrowUpRight size={20} />
        </a>
      </div>
    </article>
  );
}
