import { ArrowLeft, ArrowUpRight, Heart } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { artistById } from "../data/artists";
import { feed } from "../data/feed";
import { useArchive } from "../store/ArchiveContext";
import { ArtistArt } from "../components/ArtistArt";
import { FeedCard } from "../components/FeedCard";
import { NotFoundPage } from "./NotFoundPage";

export function ArtistDetailPage() {
  const { artistId = "" } = useParams();
  const artist = artistById(artistId);
  const { followedArtists, toggleFollow } = useArchive();
  if (!artist) return <NotFoundPage />;
  const following = followedArtists.includes(artist.id);
  return (
    <div className="page-wrap page-pad">
      <Link to="/artists" className="back-link">
        <ArrowLeft size={17} /> All artists
      </Link>
      <div className="artist-detail-hero">
        <div className="artist-detail-art">
          <ArtistArt artist={artist} variant="hero" />
        </div>
        <div className="artist-detail-copy">
          <p className="eyebrow">ARTIST FILE / {artist.debut}</p>
          <h1>{artist.name}</h1>
          <p className="detail-subtitle">{artist.subtitle}</p>
          <p className="detail-description">{artist.description}</p>
          <div className="detail-actions">
            <button
              className={`primary-button ${following ? "following" : ""}`}
              type="button"
              onClick={() => toggleFollow(artist.id)}
              aria-pressed={following}
            >
              <Heart size={17} fill={following ? "currentColor" : "none"} />
              {following ? "Following" : "Follow artist"}
            </button>
            <a
              className="outline-button"
              href={artist.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official site <ArrowUpRight size={17} />
            </a>
          </div>
          <p className="tiny-note">
            本页视觉为专辑气质的原创设计诠释，非官方封面或照片。
          </p>
        </div>
      </div>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FROM THE DEMO FEED</p>
            <h2>In your orbit</h2>
            <p className="section-note">以下内容用于展示收藏与筛选交互。</p>
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
