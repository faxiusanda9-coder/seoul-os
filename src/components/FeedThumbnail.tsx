import { useState } from "react";
import { artistById } from "../data/artists";
import type { FeedItem } from "../types";
import { thumbnailUrl, visualVideoForItem } from "../utils/media";
import { ArtistArt } from "./ArtistArt";

export function FeedThumbnail({ item }: { item: FeedItem }) {
  const [imageState, setImageState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const artist = artistById(item.artistId);
  if (!artist) return null;
  const visual = visualVideoForItem(item);
  return (
    <div className="feed-thumb">
      {visual?.videoId && imageState !== "failed" ? (
        <>
          {imageState === "loading" && (
            <div className="media-loading" aria-hidden="true">
              <ArtistArt artist={artist} variant="mini" />
            </div>
          )}
          <img
            className={imageState === "loading" ? "is-loading" : ""}
            src={thumbnailUrl(visual.videoId)}
            alt={
              item.kind === "official"
                ? `${artist.name}《${visual.title}》官方 YouTube 视频缩略图`
                : `${artist.name} 官方视频《${visual.title}》的参考缩略图；不是本条演示内容`
            }
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
