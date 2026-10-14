import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ArchiveCategory } from "../types";

type SavedEntry = { id: string; category: ArchiveCategory };
type ArchiveState = {
  saved: SavedEntry[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string, category: ArchiveCategory) => void;
  moveSaved: (id: string, category: ArchiveCategory) => void;
  followedArtists: string[];
  toggleFollow: (id: string) => void;
};

const STORAGE_KEY = "seoul-os-archive-v1";
const FOLLOW_KEY = "seoul-os-follow-v1";
const ArchiveContext = createContext<ArchiveState | null>(null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedEntry[]>(() =>
    readJson(STORAGE_KEY, []),
  );
  const [followedArtists, setFollowedArtists] = useState<string[]>(() =>
    readJson(FOLLOW_KEY, []),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);
  useEffect(() => {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(followedArtists));
  }, [followedArtists]);

  const isSaved = (id: string) => saved.some((item) => item.id === id);
  const toggleSaved = (id: string, category: ArchiveCategory) =>
    setSaved((current) =>
      current.some((item) => item.id === id)
        ? current.filter((item) => item.id !== id)
        : [...current, { id, category }],
    );
  const moveSaved = (id: string, category: ArchiveCategory) =>
    setSaved((current) =>
      current.map((item) => (item.id === id ? { ...item, category } : item)),
    );
  const toggleFollow = (id: string) =>
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
