import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { artists } from "../data/artists";
import { useContent } from "../store/ContentContext";
import { FeedCard } from "../components/FeedCard";
import { FeedFilters } from "../components/FeedFilters";
import { ArtistCard } from "../components/ArtistCard";
import { SectionHeading } from "../components/SectionHeading";
import { countContentCategories, selectFeed, type FeedSort } from "../utils/feed";
import type { ContentCategory } from "../utils/contentClassifier";
import { useI18n } from "../locales/i18n";

export function DiscoverPage() {
  const { feed, status, syncedAt, selectedArtistId, channels, selectArtist, loadChannel } = useContent();
  const { t, locale } = useI18n();
  const reducedMotion = useReducedMotion();
  const [category, setCategory] = useState<"all" | ContentCategory>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<FeedSort>("newest");
  const matching = useMemo(
    () => selectFeed(feed, { artist: selectedArtistId, category: "all", search, sort }, locale),
    [feed, selectedArtistId, search, sort, locale],
  );
  const categoryCounts = useMemo(() => countContentCategories(matching), [matching]);
  const activeCategory = category === "all" || categoryCounts[category] > 0 ? category : "all";
  useEffect(() => {
    if (activeCategory !== category) setCategory("all");
  }, [activeCategory, category]);
  const visible = activeCategory === "all" ? matching :
    matching.filter((item) => item.contentCategory === activeCategory);
  return (
    <>
      <div className="page-wrap">
        <motion.section
          className="hero"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <img
            className="hero-image"
            src={`${import.meta.env.BASE_URL}hero-concept.png`}
            alt={t("discover.heroAlt")}
          />
          <div className="hero-shade" />
          <div className="hero-top">
            <span>SEOUL.OS / ISSUE 001</span>
            <span>CONCEPT EDITION</span>
          </div>
          <div className="hero-content">
            <p className="hero-kicker">
              ONE COMPANY · EVERY ARTIST · YOUR UNIVERSE
            </p>
            <h1>
              Every era.
              <br />
              <em>All yours.</em>
            </h1>
            <p className="hero-description">{t("discover.heroDescription")}</p>
            <button
              className="hero-button"
              type="button"
              onClick={() =>
                document.getElementById("daily-feed")?.scrollIntoView({
                  behavior: reducedMotion ? "auto" : "smooth",
                })
              }
            >
              {t("common.exploreFeed")} <ArrowDown size={17} />
            </button>
          </div>
          <p className="hero-credit">{t("discover.heroCredit")}</p>
        </motion.section>
        <div className="intro-line">
          <span>YOUR K-POP UNIVERSE, ORGANIZED.</span>
          <span>JYP ARTIST CULTURE / PERSONAL ARCHIVE</span>
        </div>
        <section className="content-section feed-section" id="daily-feed">
          <SectionHeading
            eyebrow="01 / THE EDIT"
            title="Daily JYP Feed"
            subtitle={t("discover.feedSubtitle")}
            note={
              status === "live"
                ? t("discover.feedLive", {
                    artist: channels.find((item) => item.artistId === selectedArtistId)?.displayName ?? selectedArtistId,
                    date: new Intl.DateTimeFormat(locale, {
                      timeZone: "Asia/Shanghai",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(syncedAt!)),
                  })
                : status === "loading"
                  ? t("discover.feedLoading")
                  : t("discover.feedFallback")
            }
            action={
              <span className="count-label" aria-live="polite">
                {t("discover.storyCount", {
                  count: visible.length.toString().padStart(2, "0"),
                })}
              </span>
            }
          />
          <FeedFilters
            artist={selectedArtistId}
            channels={channels}
            category={activeCategory}
            categoryCounts={categoryCounts}
            categoryTotal={matching.length}
            search={search}
            sort={sort}
            onArtist={(artistId) => { selectArtist(artistId); setCategory("all"); }}
            onCategory={setCategory}
            onSearch={setSearch}
            onSort={setSort}
          />
          <p className="tiny-note">{t("discover.editorialTypeNote")}</p>
          {status === "fallback" && (
            <button className="text-button" type="button" onClick={() => loadChannel(selectedArtistId)}>
              {t("common.retryLoading")}
            </button>
          )}
          <div className="feed-list">
            {visible.length ? (
              visible.map((item) => <FeedCard key={item.id} item={item} />)
            ) : (
              <div className="empty-state">
                <Sparkles size={25} />
                <h3>{t("discover.noResultsTitle")}</h3>
                <p>{t("discover.noResultsBody")}</p>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setCategory("all");
                    setSearch("");
                    setSort("newest");
                  }}
                >
                  {t("common.clearFilters")} <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
        <section className="content-section official-preview">
          <SectionHeading
            eyebrow="02 / SOURCE INDEX"
            title="Official Updates"
            subtitle={t("official.subtitle")}
            note={t("official.previewNote")}
            action={<Link className="text-link" to="/official">{t("official.browseSources")} <ArrowUpRight size={17} /></Link>}
          />
          <div className="official-preview-links">
            <Link to="/official" className="official-preview-link"><span>01</span><strong>{t("official.noticeLinks")}</strong><ArrowUpRight size={18} /></Link>
            <Link to="/calendar" className="official-preview-link"><span>02</span><strong>{t("official.scheduleLinks")}</strong><ArrowUpRight size={18} /></Link>
          </div>
        </section>
        <section className="content-section artists-section">
          <SectionHeading
            eyebrow="02 / THE PEOPLE"
            title="The artists"
            note={t("discover.artistsNote")}
            action={
              <Link className="text-link" to="/artists">
                {t("discover.viewAllArtists")} <ArrowUpRight size={17} />
              </Link>
            }
          />
          <div className="artist-grid preview-grid">
            {artists.slice(0, 4).map((item, index) => (
              <ArtistCard key={item.id} artist={item} index={index} />
            ))}
          </div>
        </section>
        <section className="universe-banner">
          <div>
            <p className="eyebrow">03 / JYP UNIVERSE</p>
            <h2>
              A timeline of
              <br />
              <em>what stays.</em>
            </h2>
            <p>{t("discover.timelineNote")}</p>
            <Link className="light-button" to="/universe">
              {t("discover.exploreTimeline")} <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="orbit-graphic" aria-hidden="true">
            <span>2015</span>
            <span>2018</span>
            <span>2019</span>
            <span>2022</span>
          </div>
        </section>
      </div>
    </>
  );
}
