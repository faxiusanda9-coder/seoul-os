import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Artist } from "../types";
import { ArtistArt } from "./ArtistArt";

export function ArtistCard({
  artist,
  index = 0,
}: {
  artist: Artist;
  index?: number;
}) {
  return (
    <Link
      className="artist-card"
      to={`/artists/${artist.id}`}
      aria-label={`查看 ${artist.name} 档案`}
    >
      <ArtistArt artist={artist} />
      <div className="artist-card-info">
        <span className="artist-index">
          {String(index + 1).padStart(2, "0")} / ARTIST
        </span>
        <ArrowUpRight size={19} />
      </div>
      <h3>{artist.name}</h3>
      <p>{artist.subtitle}</p>
    </Link>
  );
}
