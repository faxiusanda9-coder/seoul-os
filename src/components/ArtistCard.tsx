import { ArrowUpRight, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useArchive } from "../store/ArchiveContext";
import type { Artist } from "../types";
import { ArtistVideoCover } from "./ArtistVideoCover";

export function ArtistCard({
  artist,
  index = 0,
}: {
  artist: Artist;
  index?: number;
}) {
  const { followedArtists, toggleFollow } = useArchive();
  const following = followedArtists.includes(artist.id);
  return (
    <article className="artist-card">
      <Link
        className="artist-card-link"
        to={`/artists/${artist.id}`}
        aria-label={`查看 ${artist.name} 档案`}
      >
        <ArtistVideoCover artist={artist} />
        <div className="artist-card-info">
          <span className="artist-index">
            {String(index + 1).padStart(2, "0")} / ARTIST
          </span>
          <ArrowUpRight size={19} />
        </div>
        <h3>{artist.name}</h3>
        <p>{artist.subtitle}</p>
      </Link>
      <button
        className={`artist-follow ${following ? "is-following" : ""}`}
        type="button"
        aria-pressed={following}
        aria-label={
          following ? `取消关注 ${artist.name}` : `关注 ${artist.name}`
        }
        onClick={() => toggleFollow(artist.id)}
      >
        <Heart size={16} fill={following ? "currentColor" : "none"} />
        {following ? "Following" : "Follow"}
      </button>
    </article>
  );
}
