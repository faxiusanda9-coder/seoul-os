import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { artists } from "../data/artists";
import { feed } from "../data/feed";
import { ArtistArt } from "../components/ArtistArt";
import { FeedCard } from "../components/FeedCard";

export function SearchPage() {
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
            `${item.title} ${item.type} ${artists.find((artist) => artist.id === item.artistId)?.name}`
              .toLocaleLowerCase()
              .includes(normalized),
          )
        : feed.slice(0, 4),
    }),
    [normalized],
  );
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro compact-intro">
        <p className="eyebrow">FIND YOUR NEXT FAVORITE</p>
        <h1>Search the universe.</h1>
        <p>搜索本地演示内容与艺人档案。</p>
      </div>
      <div className="search-box">
        <Search size={24} />
        <input
          autoFocus
          aria-label="搜索艺人或内容"
          placeholder="搜索艺人、演示内容、类型…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="icon-button"
            type="button"
            aria-label="清除搜索"
            onClick={() => setQuery("")}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="search-results">
        <section>
          <h2>
            Artists <span>{matches.artists.length}</span>
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
            <p className="muted">没有匹配的艺人。</p>
          )}
        </section>
        <section>
          <h2>
            Demo feed <span>{matches.feed.length}</span>
          </h2>
          {matches.feed.length ? (
            <div className="feed-list">
              {matches.feed.map((item) => (
                <FeedCard key={item.id} item={item} compact />
              ))}
            </div>
          ) : (
            <p className="muted">没有匹配的内容。</p>
          )}
        </section>
      </div>
    </div>
  );
}
