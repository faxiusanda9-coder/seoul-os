import type { Artist } from "../types";
import { useI18n } from "../locales/i18n";

export function ArtistArt({
  artist,
  variant = "card",
}: {
  artist: Artist;
  variant?: "card" | "mini" | "hero";
}) {
  const { t } = useI18n();
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
      aria-label={t("common.artistArtwork", { artist: artist.name })}
      role="img"
    >
      <span className="art-top">SEOUL.OS / ARTIST FILE</span>
      <span className="art-orbit" aria-hidden="true" />
      <span className="art-name">{artist.name}</span>
      <span className="art-bottom">{artist.mood}</span>
    </div>
  );
}
