import { artists } from "./artists";

export interface ArtistVisualConfig {
  artistId: string;
  displayName: string;
  heroImage: string | null;
  cardImage: string | null;
  imageSource: string | null;
  imageCredit: string | null;
  imageLicenseName: string | null;
  imageLicenseUrl: string | null;
  imageLicenseStatus: "design-only" | "licensed";
  objectPosition: string;
  fallbackTheme: string;
}

// Keep artist photography separate from YouTube video thumbnails.
// Add a local asset path and its source/license record here for future photos.
export const artistVisuals: Record<string, ArtistVisualConfig> = Object.fromEntries(
  artists.map((artist) => [artist.id, {
    artistId: artist.id,
    displayName: artist.name,
    heroImage: null,
    cardImage: null,
    imageSource: null,
    imageCredit: null,
    imageLicenseName: null,
    imageLicenseUrl: null,
    imageLicenseStatus: "design-only" as const,
    objectPosition: "center center",
    fallbackTheme: artist.id,
  }]),
);

const photos: Record<string, Omit<ArtistVisualConfig, "artistId" | "displayName" | "fallbackTheme">> = {
  twice: {
    cardImage: "/artist-images/twice-960.jpg", heroImage: "/artist-images/twice-1920.jpg",
    imageSource: "https://commons.wikimedia.org/wiki/File:TWICE_in_Las_Vegas_01.jpg",
    imageCredit: "David Lee", imageLicenseName: "CC BY 2.0",
    imageLicenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    imageLicenseStatus: "licensed", objectPosition: "center center",
  },
  "stray-kids": {
    cardImage: "/artist-images/stray-kids-960.jpg", heroImage: "/artist-images/stray-kids-1920.jpg",
    imageSource: "https://commons.wikimedia.org/wiki/File:Stray_Kids_at_the_40th_Golden_Disc_Awards,_January_10,_2026_(1).png",
    imageCredit: "K-POPIT", imageLicenseName: "CC BY 4.0",
    imageLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    imageLicenseStatus: "licensed", objectPosition: "center center",
  },
  itzy: {
    cardImage: "/artist-images/itzy-960.jpg", heroImage: "/artist-images/itzy-1920.jpg",
    imageSource: "https://commons.wikimedia.org/wiki/File:251110_ITZY.png",
    imageCredit: "TV10", imageLicenseName: "CC BY 4.0",
    imageLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    imageLicenseStatus: "licensed", objectPosition: "center center",
  },
  nmixx: {
    cardImage: "/artist-images/nmixx-960.jpg", heroImage: "/artist-images/nmixx-1920.jpg",
    imageSource: "https://commons.wikimedia.org/wiki/File:NMIXX_in_Oakland.jpg",
    imageCredit: "David Lee", imageLicenseName: "CC BY 4.0",
    imageLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    imageLicenseStatus: "licensed", objectPosition: "center center",
  },
};

for (const [artistId, photo] of Object.entries(photos)) {
  artistVisuals[artistId] = { ...artistVisuals[artistId], ...photo };
}
