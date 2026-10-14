import { feed } from "../data/feed";
import type { FeedItem } from "../types";

export function officialVideoForArtist(artistId: string): FeedItem | undefined {
  return feed.find(
    (item) =>
      item.artistId === artistId && item.kind === "official" && !!item.videoId,
  );
}

/** Demo rows borrow an artist reference image; they do not depict that demo. */
export function visualVideoForItem(item: FeedItem): FeedItem | undefined {
  return item.kind === "official" ? item : officialVideoForArtist(item.artistId);
}

export function thumbnailUrl(videoId: string): string {
  return `${import.meta.env.BASE_URL}video-thumbnails/${videoId}.jpg`;
}
