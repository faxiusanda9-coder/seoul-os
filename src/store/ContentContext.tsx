import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { feed as curatedFeed } from "../data/feed";
import {
  parseContentSnapshot,
  type Content,
} from "../../data/schemas/content.schema";
import type { ContentType, FeedItem } from "../types";

type ContentState = {
  feed: FeedItem[];
  status: "loading" | "live" | "fallback";
  syncedAt: string | null;
};
const ContentContext = createContext<ContentState | null>(null);

const TYPE_MAP: Record<Content["type"], ContentType> = {
  "music-video": "Music Video",
  performance: "Performance",
  teaser: "Teaser",
  announcement: "Announcement",
  other: "Other",
};

function toFeedItem(item: Content): FeedItem {
  const type = TYPE_MAP[item.type];
  return {
    id: item.id,
    artistId: item.artist.id,
    title: item.title,
    type,
    source: "YouTube · TWICE Official",
    sourceUrl: item.url,
    category:
      type === "Music Video"
        ? "Music Videos"
        : type === "Performance"
          ? "Favorite Stages"
          : "Watch Later",
    visual: "twice",
    kind: "live",
    publishedAt: item.publishedAt,
    videoId: item.source.videoId,
    thumbnailUrl: item.thumbnail,
  };
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContentState>({
    feed: curatedFeed,
    status: "loading",
    syncedAt: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/youtube/twice.json`, {
      signal: controller.signal,
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No published YouTube snapshot");
        const snapshot = parseContentSnapshot(await response.json());
        if (!snapshot?.fetchedAt || !snapshot.items.length)
          throw new Error("No live items");
        if (
          Date.now() - Date.parse(snapshot.fetchedAt) >
          30 * 24 * 60 * 60 * 1000
        )
          throw new Error("Snapshot expired");
        setState({
          feed: [
            ...snapshot.items.map(toFeedItem),
            ...curatedFeed.filter((item) => item.artistId !== "twice"),
          ],
          status: "live",
          syncedAt: snapshot.fetchedAt,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setState({ feed: curatedFeed, status: "fallback", syncedAt: null });
      });
    return () => controller.abort();
  }, []);

  return (
    <ContentContext.Provider value={state}>{children}</ContentContext.Provider>
  );
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context)
    throw new Error("useContent must be used within ContentProvider");
  return context;
}
