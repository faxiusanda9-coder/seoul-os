import { useEffect } from "react";
import { ArrowLeft, ArrowUpRight, Heart } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { artistById } from "../data/artists";
import { artistVisuals } from "../data/artistVisuals";
import { useContent } from "../store/ContentContext";
import { useArchive } from "../store/ArchiveContext";
import { ArtistVisual } from "../components/ArtistVisual";
import { ArtistPhotoCredit } from "../components/ArtistPhotoCredit";
import { FeedCard } from "../components/FeedCard";
import { NotFoundPage } from "./NotFoundPage";
import { artistDescription, useI18n } from "../locales/i18n";

export function ArtistDetailPage() {
  const { getChannel, loadChannel } = useContent();
  const { artistId = "" } = useParams();
  useEffect(() => { loadChannel(artistId); }, [artistId, loadChannel]);
  const { feed, status, syncedAt } = getChannel(artistId);
  const artist = artistById(artistId);
  const { followedArtists, toggleFollow } = useArchive();
  const { t, locale } = useI18n();
  if (!artist) return <NotFoundPage />;
  const following = followedArtists.includes(artist.id);
  return (
    <div className="page-wrap page-pad">
      <Link to="/artists" className="back-link">
        <ArrowLeft size={17} /> {t("artists.back")}
      </Link>
      <div className="artist-detail-hero">
        <div className="artist-detail-art">
          <ArtistVisual artist={artist} variant="hero" />
          <ArtistPhotoCredit artistId={artist.id} />
        </div>
        <div className="artist-detail-copy">
          <p className="eyebrow" lang={locale}>
            {t("artists.file")}{artist.debut ? ` / ${artist.debut}` : ""}
          </p>
          <h1>{artist.name}</h1>
          <p className="detail-subtitle">{artist.subtitle}</p>
          <p className="detail-description">
            {artistDescription(locale, artist.id, artist.description)}
          </p>
          <div className="detail-actions">
            <button
              className={`primary-button ${following ? "following" : ""}`}
              type="button"
              onClick={() => toggleFollow(artist.id)}
              aria-pressed={following}
            >
              <Heart size={17} fill={following ? "currentColor" : "none"} />
              {following ? t("artists.following") : t("artists.follow")}
            </button>
            <a
              className="outline-button"
              href={artist.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t(artist.officialUrl.includes("youtube.com") ? "common.officialChannel" : "common.officialSite")} <ArrowUpRight size={17} />
            </a>
          </div>
          <p className="tiny-note">{t(artistVisuals[artist.id]?.imageLicenseStatus === "licensed" ? "artists.photoVisualNote" : "artists.detailVisualNote")}</p>
        </div>
      </div>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FROM THE CURATED FEED</p>
            <h2>In your orbit</h2>
            <p className="section-note">
              {status === "live"
                ? t("artists.relatedLive", { date: new Intl.DateTimeFormat(locale, {
                    timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short",
                  }).format(new Date(syncedAt!)) })
                : t("artists.relatedSample")}
            </p>
            {status === "fallback" && (
              <button className="text-button" type="button" onClick={() => loadChannel(artistId)}>
                {t("common.retryLoading")}
              </button>
            )}
          </div>
        </div>
        <div className="feed-list">
          {feed
            .filter((item) => item.artistId === artist.id)
            .map((item) => (
              <FeedCard item={item} key={item.id} />
            ))}
        </div>
      </section>
    </div>
  );
}
