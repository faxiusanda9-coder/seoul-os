import { useState } from "react";
import type { Artist } from "../types";
import { artistVisuals } from "../data/artistVisuals";
import { ArtistArt } from "./ArtistArt";

export function ArtistVisual({ artist, variant = "card" }: { artist: Artist; variant?: "card" | "hero" }) {
  const [failed, setFailed] = useState(false);
  const visual = artistVisuals[artist.id];
  const image = variant === "hero" ? visual?.heroImage : visual?.cardImage;
  const permitted = visual?.imageLicenseStatus === "licensed" && visual.imageSource && visual.imageCredit && visual.imageLicenseUrl;
  const src = image?.startsWith("/") ? `${import.meta.env.BASE_URL}${image.slice(1)}` : image;
  const cardSrc = visual?.cardImage?.startsWith("/") ? `${import.meta.env.BASE_URL}${visual.cardImage.slice(1)}` : visual?.cardImage;
  const heroSrc = visual?.heroImage?.startsWith("/") ? `${import.meta.env.BASE_URL}${visual.heroImage.slice(1)}` : visual?.heroImage;
  return (
    <div className={`artist-visual artist-visual--${variant}${permitted && src && !failed ? " artist-visual--photo" : ""}`}>
      {permitted && src && !failed ? (
        <img src={src} alt={artist.name} width={variant === "hero" ? 1200 : 680}
          height={variant === "hero" ? 1200 : 730}
          srcSet={cardSrc && heroSrc ? `${cardSrc} 960w, ${heroSrc} 1920w` : undefined}
          sizes={variant === "hero" ? "(max-width: 900px) 100vw, 55vw" : "(max-width: 600px) 46vw, (max-width: 900px) 30vw, 31vw"}
          loading={variant === "hero" ? "eager" : "lazy"}
          decoding="async" onError={() => setFailed(true)}
          style={{ objectPosition: visual.objectPosition }} />
      ) : <ArtistArt artist={artist} variant={variant} />}
    </div>
  );
}
