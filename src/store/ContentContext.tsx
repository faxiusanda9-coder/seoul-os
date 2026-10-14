import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import rawChannels from "../../data/youtube/channels.json";
import { feed as curatedFeed } from "../data/feed";
import { parseChannelSnapshot, parseChannelsConfig, type Content, type ChannelConfig } from "../../data/schemas/content.schema";
import type { ContentType, FeedItem } from "../types";

type ChannelView = {
  feed: FeedItem[];
  status: "loading" | "live" | "fallback";
  syncedAt: string | null;
};
type ContentState = ChannelView & {
  selectedArtistId: string;
  channels: ChannelConfig[];
  selectArtist: (artistId: string) => void;
  getChannel: (artistId: string) => ChannelView;
  loadChannel: (artistId: string) => void;
};
const ContentContext = createContext<ContentState | null>(null);
const config = parseChannelsConfig(rawChannels);
if (!config) throw new Error("Published channel configuration is invalid");
export const enabledChannels = config.channels.filter((channel) => channel.enabled);
const channelByArtist = new Map(enabledChannels.map((channel) => [channel.artistId, channel]));
const selectionKey = "seoul-os-channel-v1";

const TYPE_MAP: Record<Content["type"], ContentType> = {
  "music-video": "Music Video", performance: "Performance", teaser: "Teaser",
  announcement: "Announcement", other: "Other",
};

function toFeedItem(item: Content): FeedItem {
  const type = TYPE_MAP[item.type];
  return {
    id: item.id, artistId: item.artist.id, title: item.title, type,
    source: `YouTube · ${item.artist.name}`,
    sourceUrl: item.url,
    category: type === "Music Video" ? "Music Videos" : type === "Performance" ? "Favorite Stages" : "Watch Later",
    visual: item.artist.id, kind: "live", publishedAt: item.publishedAt,
    videoId: item.source.videoId, thumbnailUrl: item.thumbnail,
    localizedTitle: item.localizedTitle, localizedDescription: item.localizedDescription,
    originalLanguage: item.originalLanguage, translationVerified: item.translationVerified,
  };
}

function fallback(artistId: string): ChannelView {
  return { feed: curatedFeed.filter((item) => item.artistId === artistId), status: "fallback", syncedAt: null };
}

function initialArtist() {
  try {
    const saved = localStorage.getItem(selectionKey);
    if (saved && channelByArtist.has(saved)) return saved;
  } catch { /* Storage is optional. */ }
  return "twice";
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const [selectedArtistId, setSelectedArtistId] = useState(initialArtist);
  const [views, setViews] = useState<Record<string, ChannelView>>({});
  const inflight = useRef(new Set<string>());

  const loadChannel = useCallback((artistId: string) => {
    const channel = channelByArtist.get(artistId);
    if (!channel || inflight.current.has(artistId)) return;
    inflight.current.add(artistId);
    setViews((current) => ({ ...current, [artistId]: { feed: fallback(artistId).feed, status: "loading", syncedAt: null } }));
    fetch(`${import.meta.env.BASE_URL}data/youtube/${artistId}.json`, { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`No published snapshot for ${artistId}`);
        const snapshot = parseChannelSnapshot(await response.json(), channel);
        if (!snapshot?.fetchedAt || !snapshot.items.length ||
            Date.now() - Date.parse(snapshot.fetchedAt) >= 30 * 24 * 60 * 60 * 1000)
          throw new Error(`No current videos for ${artistId}`);
        setViews((current) => ({ ...current, [artistId]: {
          feed: snapshot.items.map(toFeedItem), status: "live", syncedAt: snapshot.fetchedAt,
        } }));
      })
      .catch(() => setViews((current) => ({ ...current, [artistId]: fallback(artistId) })))
      .finally(() => inflight.current.delete(artistId));
  }, []);

  useEffect(() => { loadChannel(selectedArtistId); }, [loadChannel, selectedArtistId]);
  const selectArtist = useCallback((artistId: string) => {
    if (!channelByArtist.has(artistId)) return;
    setSelectedArtistId(artistId);
    try { localStorage.setItem(selectionKey, artistId); } catch { /* Storage is optional. */ }
  }, []);
  const getChannel = useCallback((artistId: string): ChannelView => views[artistId] ?? fallback(artistId), [views]);
  const selected = views[selectedArtistId] ?? { ...fallback(selectedArtistId), status: "loading" as const };
  return (
    <ContentContext.Provider value={{ ...selected, selectedArtistId, channels: enabledChannels,
      selectArtist, getChannel, loadChannel }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw new Error("useContent must be used within ContentProvider");
  return context;
}
