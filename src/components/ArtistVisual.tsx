import { useState } from "react";
import type { Artist } from "../types";
import { artistVisuals } from "../data/artistVisuals";
import { ArtistArt } from "./ArtistArt";

export function ArtistVisual({ artist, variant = "card" }: { artist: Artist; variant?: "card" | "hero" }) {
  const [failed, setFailed] = useState(false);
  const visual = artistVisuals[artist.id];
  const image = variant === "hero" ? visual?.heroImage : visual?.cardImage;
  const permitted = visual?.imageLicenseStatus === "licensed" && visual.imageSource && visual.imageCredit;
  const src = image?.startsWith("/") ? `${import.meta.env.BASE_URL}${image.slice(1)}` : image;
  return (
    <div className={`artist-visual artist-visual--${variant}`}>
      {permitted && src && !failed ? (
        <img src={src} alt={artist.name} width={variant === "hero" ? 1200 : 680}
          height={variant === "hero" ? 1200 : 730}
          loading={variant === "hero" ? "eager" : "lazy"}
          decoding="async" onError={() => setFailed(true)}
          style={{ objectPosition: visual.objectPosition }} />
      ) : <ArtistArt artist={artist} variant={variant} />}
    </div>
  );
}
