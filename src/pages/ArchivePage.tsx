import { useEffect, useState } from "react";
import { Bookmark, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { archiveCategories } from "../data/feed";
import { useContent } from "../store/ContentContext";
import { artistById, artists } from "../data/artists";
import { FeedThumbnail } from "../components/FeedThumbnail";
import { useArchive } from "../store/ArchiveContext";
import type { ArchiveCategory } from "../types";
import { publishedLabel } from "../utils/feed";
import { visualVideoForItem } from "../utils/media";
import {
  archiveCategoryLabel,
  contentTypeLabel,
  useI18n,
} from "../locales/i18n";

export function ArchivePage() {
  const { selectedArtistId, getChannel, loadChannel } = useContent();
  const { saved, toggleSaved, moveSaved } = useArchive();
  const { t, locale } = useI18n();
  const [category, setCategory] = useState<ArchiveCategory>(
    () => saved.at(-1)?.category ?? "Favorite Stages",
  );
  const [archiveArtistId, setArchiveArtistId] = useState(
    () => saved.at(-1)?.artistId ?? selectedArtistId,
  );
  useEffect(() => { loadChannel(archiveArtistId); }, [archiveArtistId, loadChannel]);
  const feed = getChannel(archiveArtistId).feed;
  const channelSaved = saved.filter((entry) => entry.artistId === archiveArtistId);
  const visible = channelSaved
    .filter((item) => item.category === category)
    .map((entry) => ({ entry, item: feed.find((row) => row.id === entry.id) }));
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">YOUR PRIVATE COLLECTION</p>
        <h1>
          My Archive<span className="period">.</span>
        </h1>
        <p>{t("archive.intro")}</p>
      </div>
      <div className="archive-overview">
        <span>{String(saved.length).padStart(2, "0")}</span>
        <p>{t("archive.count", { count: saved.length })}</p>
        <Bookmark size={27} strokeWidth={1.4} />
      </div>
      <label className="select-field archive-channel-select">
        <span>{t("archive.channel")}</span>
        <select value={archiveArtistId} onChange={(event) => setArchiveArtistId(event.target.value)}>
          {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
        </select>
      </label>
      <div className="archive-tabs" aria-label={t("archive.categories")}>
        {archiveCategories.map((item) => (
          <button
            type="button"
            aria-pressed={category === item}
            className={category === item ? "active" : ""}
            key={item}
            onClick={() => setCategory(item)}
          >
            {archiveCategoryLabel(locale, item)}
            <span>
              {channelSaved.filter((entry) => entry.category === item).length}
            </span>
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="archive-grid">
          {visible.map(({ entry, item }) => {
            if (!item)
              return (
                <article
                  className="archive-card archive-missing"
                  key={entry.id}
                >
                  <div className="archive-card-copy">
                    <p className="eyebrow">
                      YOUTUBE / {t("common.bookmarkShort")}
                    </p>
                    <h2>{t("archive.savedVideo")}</h2>
                    <p>{t("archive.savedVideoNote")}</p>
                    <div className="archive-card-actions">
                      <label className="select-field small-select">
                        <span>{t("archive.moveTo")}</span>
                        <select
                          value={category}
                          onChange={(e) => {
                            const next = e.target.value as ArchiveCategory;
                            moveSaved(entry.id, next);
                            setCategory(next);
                          }}
                          aria-label={t("archive.moveSaved")}
                        >
                          {archiveCategories.map((option) => (
                            <option key={option} value={option}>
                              {archiveCategoryLabel(locale, option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={t("archive.removeSaved")}
                      onClick={() => toggleSaved(entry.id, category, entry.artistId)}
                      >
                        <Bookmark size={18} fill="currentColor" />
                      </button>
                      <a
                        className="icon-button"
                        href={`https://www.youtube.com/watch?v=${entry.id.slice(3)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("archive.openSaved")}
                      >
                        <ArrowUpRight size={18} />
                      </a>
                    </div>
                  </div>
                </article>
              );
            const artist = artistById(item.artistId);
            if (!artist) return null;
            const visual = visualVideoForItem(item);
            return (
              <article className="archive-card" key={item.id}>
                <a
                  href={visual?.sourceUrl ?? item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={
                    item.kind === "demo"
                      ? t("common.watchReference", { artist: artist.name })
                      : t("archive.openNamed", { title: item.title })
                  }
                >
                  <FeedThumbnail item={item} sizes="(max-width: 600px) 88vw, (max-width: 900px) 40vw, 360px" />
                </a>
                <div className="archive-card-copy">
                  <p className="eyebrow">
                    {artist.name} / {contentTypeLabel(locale, item.type)}
                  </p>
                  <h2>
                    {item.kind === "demo"
                      ? t("demo.feedTitle", {
                          type: contentTypeLabel(locale, item.type),
                        })
                      : item.title}
                  </h2>
                  {locale === "zh-CN" &&
                    item.translationVerified &&
                    item.localizedTitle && (
                      <p className="feed-local-title">{item.localizedTitle}</p>
                    )}
                  <p>
                    {item.kind === "demo"
                      ? t("common.demoSource")
                      : item.kind === "official"
                        ? t("common.sampleSource")
                        : item.source}{" "}
                    · {publishedLabel(item, locale)}
                  </p>
                  {item.kind === "demo" && visual && (
                    <p className="reference-credit">
                      {t("common.coverReference", { title: visual.title })}
                    </p>
                  )}
                  <div className="archive-card-actions">
                    <label className="select-field small-select">
                      <span>{t("archive.moveTo")}</span>
                      <select
                        value={category}
                        onChange={(e) => {
                          const next = e.target.value as ArchiveCategory;
                          moveSaved(item.id, next);
                          setCategory(next);
                        }}
                        aria-label={t("archive.moveNamed", {
                          title: item.title,
                        })}
                      >
                        {archiveCategories.map((option) => (
                          <option key={option} value={option}>
                            {archiveCategoryLabel(locale, option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={t("common.removeBookmark", {
                        title: item.title,
                      })}
                      onClick={() => toggleSaved(item.id, category, item.artistId)}
                    >
                      <Bookmark size={18} fill="currentColor" />
                    </button>
                    <a
                      className="icon-button"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("archive.openNamed", { title: item.title })}
                    >
                      <ArrowUpRight size={18} />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state archive-empty">
          <Bookmark size={28} />
          <h2>
            {channelSaved.length
              ? t("archive.emptyCategory", {
                  category: archiveCategoryLabel(locale, category),
                })
              : t("archive.emptyAll")}
          </h2>
          <p>
            {channelSaved.length
              ? t("archive.emptyCategoryBody")
              : t("archive.emptyAllBody")}
          </p>
          <Link className="primary-button" to="/#daily-feed">
            {t("common.exploreFeed")} <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}
