import { useState } from "react";
import { artistById } from "../data/artists";
import type { FeedItem } from "../types";
import { ArtistArt } from "./ArtistArt";

export function FeedThumbnail({ item }: { item: FeedItem }) {
  const [imageState, setImageState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const artist = artistById(item.artistId);
  if (!artist) return null;
  return (
    <div className="feed-thumb">
      {item.videoId && imageState !== "failed" ? (
        <>
          {imageState === "loading" && (
            <div className="media-loading" aria-hidden="true">
              <ArtistArt artist={artist} variant="mini" />
            </div>
          )}
          <img
            className={imageState === "loading" ? "is-loading" : ""}
            src={`https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`}
            alt={`${artist.name}《${item.title}》官方 YouTube 视频缩略图`}
            loading="lazy"
            decoding="async"
            onError={() => setImageState("failed")}
            onLoad={(event) => {
              setImageState(
                event.currentTarget.naturalWidth < 300 ? "failed" : "ready",
              );
            }}
          />
        </>
      ) : (
        <ArtistArt artist={artist} variant="mini" />
      )}
    </div>
  );
}
