import { artists } from "./artists";

export interface ArtistVisualConfig {
  artistId: string;
  displayName: string;
  heroImage: string | null;
  cardImage: string | null;
  imageSource: string | null;
  imageCredit: string | null;
  imageLicenseStatus: "design-only" | "licensed";
  objectPosition: string;
  fallbackTheme: string;
}

// No artist photographs have been supplied with confirmed reuse rights yet.
// Add a local public asset path and its rights record here when one is available.
export const artistVisuals: Record<string, ArtistVisualConfig> = Object.fromEntries(
  artists.map((artist) => [artist.id, {
    artistId: artist.id,
    displayName: artist.name,
    heroImage: null,
    cardImage: null,
    imageSource: null,
    imageCredit: null,
    imageLicenseStatus: "design-only" as const,
    objectPosition: "center center",
    fallbackTheme: artist.id,
  }]),
);
