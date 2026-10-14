import type { Artist } from "../types";

export function ArtistArt({
  artist,
  variant = "card",
}: {
  artist: Artist;
  variant?: "card" | "mini" | "hero";
}) {
  return (
    <div
      className={`artist-art artist-art--${variant} artist-art--${artist.id}`}
      style={
        {
          "--art-bg": artist.color,
          "--art-ink": artist.ink,
          "--art-accent": artist.accent,
        } as React.CSSProperties
      }
      aria-label={`${artist.name} 非官方概念视觉`}
      role="img"
    >
      <span className="art-top">SEOUL.OS / ARTIST FILE</span>
      <span className="art-orbit" aria-hidden="true" />
      <span className="art-name">{artist.name}</span>
      <span className="art-bottom">{artist.mood}</span>
    </div>
  );
}
