import { useState } from "react";
import { artistById } from "../data/artists";
import type { FeedItem } from "../types";
import { thumbnailUrl, visualVideoForItem } from "../utils/media";
import { ArtistArt } from "./ArtistArt";
import { useI18n } from "../locales/i18n";
import { responsiveThumbnail } from "../utils/thumbnails";

export function FeedThumbnail({ item, sizes = "(max-width: 600px) 40vw, (max-width: 900px) 30vw, 176px" }: { item: FeedItem; sizes?: string }) {
  const { t } = useI18n();
  const [imageState, setImageState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const artist = artistById(item.artistId);
  if (!artist) return null;
  const visual = visualVideoForItem(item);
  const { urls, srcSet } = responsiveThumbnail(visual?.thumbnails ?? [], visual?.thumbnailUrl ?? (visual?.videoId ? thumbnailUrl(visual.videoId) : undefined));
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const activeUrls = urls.filter((url) => !failedUrls.includes(url));
  const activeSrcSet = failedUrls.length ? "" : srcSet;
  return (
    <div className="feed-thumb">
      {visual?.videoId && activeUrls.length > 0 && imageState !== "failed" ? (
        <>
          {imageState === "loading" && (
            <div className="media-loading" aria-hidden="true">
              <ArtistArt artist={artist} variant="mini" />
            </div>
          )}
          <img
            className={imageState === "loading" ? "is-loading" : ""}
            src={activeUrls[0]}
            srcSet={activeSrcSet || undefined}
            sizes={activeSrcSet ? sizes : undefined}
            width={visual.thumbnails?.[0]?.width ?? 320}
            height={visual.thumbnails?.[0]?.height ?? 180}
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
            onError={(event) => {
              const failed = event.currentTarget.currentSrc || event.currentTarget.src;
              setFailedUrls((current) => [...current, failed]);
              if (activeUrls.length <= 1) setImageState("failed");
            }}
            onLoad={(event) => {
              if (event.currentTarget.naturalWidth < 100 && activeUrls.length > 1) {
                setFailedUrls((current) => [...current, event.currentTarget.currentSrc]);
              } else setImageState("ready");
            }}
          />
        </>
      ) : (
        <ArtistArt artist={artist} variant="mini" />
      )}
    </div>
  );
}
