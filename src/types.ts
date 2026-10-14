export type ContentType =
  | "Music Video"
  | "Performance"
  | "Comeback"
  | "Teaser"
  | "Announcement"
  | "Live";
export type ArchiveCategory =
  "Favorite Stages" | "Music Videos" | "Albums" | "Watch Later";
export type EventType = "Release" | "Live" | "Fan Event";

export interface Artist {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  debut: string;
  mood: string;
  color: string;
  ink: string;
  accent: string;
  officialUrl: string;
}

export interface FeedItem {
  id: string;
  artistId: string;
  title: string;
  type: ContentType;
  source: string;
  sourceUrl: string;
  category: ArchiveCategory;
  visual: string;
  publishedAt: null;
}

export interface CalendarEvent {
  id: string;
  artistId: string;
  title: string;
  type: EventType;
  startsAt: string;
  timeZone: "Asia/Seoul";
  note: string;
}

export interface TimelineItem {
  year: number;
  date: string;
  artistId: string;
  title: string;
  description: string;
  sourceUrl: string;
}
