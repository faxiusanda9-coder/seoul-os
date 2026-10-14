import { useState } from "react";
import { feed } from "../data/feed";
import type { Artist } from "../types";
import { ArtistArt } from "./ArtistArt";

export function ArtistVideoCover({ artist }: { artist: Artist }) {
  const [imageState, setImageState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const video = feed.find(
    (item) =>
      item.artistId === artist.id && item.kind === "official" && item.videoId,
  );
  if (!video?.videoId || imageState === "failed")
    return <ArtistArt artist={artist} />;
  return (
    <div className="artist-video-cover">
      <div className="artist-video-frame">
        {imageState === "loading" && (
          <div className="media-loading" aria-hidden="true">
            <ArtistArt artist={artist} variant="mini" />
          </div>
        )}
        <img
          className={imageState === "loading" ? "is-loading" : ""}
          src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`}
          alt={`${artist.name} 官方视频《${video.title}》缩略图`}
          loading="lazy"
          decoding="async"
          onError={() => setImageState("failed")}
          onLoad={(event) => {
            setImageState(
              event.currentTarget.naturalWidth < 300 ? "failed" : "ready",
            );
          }}
        />
      </div>
      <div className="artist-video-cover-label">
        <ArtistArt artist={artist} variant="mini" />
      </div>
      <span className="artist-video-credit">
        官方视频缩略图 · YouTube
      </span>
    </div>
  );
}
