import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ArchiveCategory } from "../types";
import { archiveCategories, feed } from "../data/feed";
import { artists } from "../data/artists";

export type SavedEntry = { id: string; category: ArchiveCategory; artistId: string };
type ArchiveState = {
  saved: SavedEntry[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string, category: ArchiveCategory, artistId?: string) => void;
  moveSaved: (id: string, category: ArchiveCategory) => void;
  followedArtists: string[];
  toggleFollow: (id: string) => void;
  storageWarning: boolean;
};

const STORAGE_KEY = "seoul-os-archive-v1";
const FOLLOW_KEY = "seoul-os-follow-v1";
const ArchiveContext = createContext<ArchiveState | null>(null);

const validItemIds = new Set(feed.map((item) => item.id));
const validItemId = (id: string) =>
  validItemIds.has(id) || /^yt-[A-Za-z0-9_-]{11}$/.test(id);
const validArtistIds = new Set(artists.map((artist) => artist.id));
const validCategories = new Set<string>(archiveCategories);

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readSaved(): SavedEntry[] {
  const value = readJson(STORAGE_KEY);
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry): SavedEntry[] => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      !validItemId(entry.id) ||
      !validCategories.has(entry.category) ||
      seen.has(entry.id)
    )
      return [];
    seen.add(entry.id);
    const staticArtist = feed.find((item) => item.id === entry.id)?.artistId;
    const artistId = validArtistIds.has(entry.artistId)
      ? entry.artistId
      : staticArtist ?? "twice";
    return [{ id: entry.id, category: entry.category, artistId }];
  });
}

function readFollowed(): string[] {
  const value = readJson(FOLLOW_KEY);
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" && validArtistIds.has(id),
          ),
        ),
      ]
    : [];
}

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedEntry[]>(readSaved);
  const [followedArtists, setFollowedArtists] =
    useState<string[]>(readFollowed);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      setStorageWarning(true);
    }
  }, [saved]);
  useEffect(() => {
    try {
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(followedArtists));
    } catch {
      setStorageWarning(true);
    }
  }, [followedArtists]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSaved(readSaved());
      if (event.key === FOLLOW_KEY) setFollowedArtists(readFollowed());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const isSaved = (id: string) => saved.some((item) => item.id === id);
  const toggleSaved = (id: string, category: ArchiveCategory, artistId?: string) =>
    validItemId(id) &&
    setSaved((current) =>
      current.some((item) => item.id === id)
        ? current.filter((item) => item.id !== id)
        : [...current, { id, category, artistId: artistId && validArtistIds.has(artistId)
            ? artistId : feed.find((item) => item.id === id)?.artistId ?? "twice" }],
    );
  const moveSaved = (id: string, category: ArchiveCategory) =>
    setSaved((current) =>
      current.map((item) => (item.id === id ? { ...item, category } : item)),
    );
  const toggleFollow = (id: string) =>
    validArtistIds.has(id) &&
    setFollowedArtists((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  return (
    <ArchiveContext.Provider
      value={{
        saved,
        isSaved,
        toggleSaved,
        moveSaved,
        followedArtists,
        toggleFollow,
        storageWarning,
      }}
    >
      {children}
    </ArchiveContext.Provider>
  );
}

export function useArchive() {
  const context = useContext(ArchiveContext);
  if (!context)
    throw new Error("useArchive must be used within ArchiveProvider");
  return context;
}
