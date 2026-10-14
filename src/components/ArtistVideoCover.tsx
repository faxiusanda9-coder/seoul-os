import { useState } from "react";
import type { Artist } from "../types";
import { officialVideoForArtist, thumbnailUrl } from "../utils/media";
import { ArtistArt } from "./ArtistArt";
import { useI18n } from "../locales/i18n";

export function ArtistVideoCover({ artist }: { artist: Artist }) {
  const { t } = useI18n();
  const [imageState, setImageState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const video = officialVideoForArtist(artist.id);
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
          src={thumbnailUrl(video.videoId)}
          alt={t("common.artistVideoThumbnail", {
            artist: artist.name,
            title: video.title,
          })}
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
      <span className="artist-video-credit">{t("common.thumbnailCredit")}</span>
    </div>
  );
}
