import { useState } from "react";
import { artistById } from "../data/artists";
import type { FeedItem } from "../types";
import { thumbnailUrl, visualVideoForItem } from "../utils/media";
import { ArtistArt } from "./ArtistArt";
import { useI18n } from "../locales/i18n";

export function FeedThumbnail({ item }: { item: FeedItem }) {
  const { t } = useI18n();
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
            src={visual.thumbnailUrl ?? thumbnailUrl(visual.videoId)}
            alt={
              item.kind !== "demo"
                ? t("common.videoThumbnail", {
                    artist: artist.name,
                    title: visual.title,
                  })
                : t("common.referenceThumbnail", {
                    artist: artist.name,
                    title: visual.title,
                  })
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
