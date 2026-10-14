import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { artists } from "../data/artists";
import { useContent } from "../store/ContentContext";
import { ArtistArt } from "../components/ArtistArt";
import { FeedCard } from "../components/FeedCard";
import { useI18n } from "../locales/i18n";
import { searchableFeedText } from "../utils/feed";

export function SearchPage() {
  const { feed } = useContent();
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const matches = useMemo(
    () => ({
      artists: normalized
        ? artists.filter((item) =>
            `${item.name} ${item.subtitle}`
              .toLocaleLowerCase()
              .includes(normalized),
          )
        : artists,
      feed: normalized
        ? feed.filter((item) =>
            searchableFeedText(item, locale).includes(normalized),
          )
        : feed.slice(0, 4),
    }),
    [normalized, feed, locale],
  );
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro compact-intro">
        <p className="eyebrow">FIND YOUR NEXT FAVORITE</p>
        <h1>Search the universe.</h1>
        <p>{t("search.intro")}</p>
      </div>
      <div className="search-box">
        <Search size={24} />
        <input
          aria-label={t("search.input")}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="icon-button"
            type="button"
            aria-label={t("common.clearSearch")}
            onClick={() => setQuery("")}
          >
            <X size={20} />
          </button>
        )}
      </div>
      {normalized &&
      matches.artists.length === 0 &&
      matches.feed.length === 0 ? (
        <div className="empty-state search-empty">
          <Search size={28} />
          <h2>{t("search.emptyTitle")}</h2>
          <p>{t("search.emptyBody")}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setQuery("")}
          >
            {t("common.clearSearch")}
          </button>
          <Link className="text-link" to="/artists">
            {t("common.browseArtists")}
          </Link>
        </div>
      ) : (
        <div className="search-results">
          <section>
            <h2>
              {t("search.artistCount")} <span>{matches.artists.length}</span>
            </h2>
            {matches.artists.length ? (
              <div className="search-artist-list">
                {matches.artists.map((item) => (
                  <Link
                    to={`/artists/${item.id}`}
                    key={item.id}
                    className="search-artist"
                  >
                    <ArtistArt artist={item} variant="mini" />
                    <span>
                      {item.name}
                      <small>{item.subtitle}</small>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">{t("search.noArtists")}</p>
            )}
          </section>
          <section>
            <h2>
              {t("search.feedCount")} <span>{matches.feed.length}</span>
            </h2>
            {matches.feed.length ? (
              <div className="feed-list">
                {matches.feed.map((item) => (
                  <FeedCard key={item.id} item={item} compact />
                ))}
              </div>
            ) : (
              <p className="muted">{t("search.noContent")}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
