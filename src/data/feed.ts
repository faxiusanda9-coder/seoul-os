import type { FeedItem } from "../types";

// Curated historical videos, not a live news feed. Dates have day precision.
// Direct source URLs are also recorded in ASSET_PROVENANCE.md.
const official: Array<[string, string, string, string | null, string]> = [
  [
    "xdinary-heroes",
    "Obsessed with Youth",
    "10_1vuZAeP0",
    "2026-10-12",
    "Xdinary Heroes",
  ],
  ["nexz", "SAUCIN'", "1zZQa0-QQIA", "2026-08-24", "NEXZ"],
  ["stray-kids", "This & That", "BZ4UzthYTss", "2026-08-07", "Stray Kids"],
  ["day6", "INSIDE OUT", "-N-pmPKS-bE", "2025-09-05", "DAY6"],
  ["niziu", "Make you happy (2026 ver.)", "BKXJNIhxFG0", null, "NiziU"],
  ["itzy", "Motto", "1jKnI_ib8c8", "2026-05-18", "ITZY"],
  ["nmixx", "Heavy Serenade", "6Ycn9qZK09I", "2026-05-11", "NMIXX"],
  [
    "kickflip",
    "눈에 거슬리고 싶어 (Eye-Poppin’)",
    "i5S7DBQnqP0",
    "2026-04-06",
    "KickFlip",
  ],
  ["twice", "ME+YOU", "zqorlX_5oHQ", "2025-10-10", "TWICE"],
];

export const feed: FeedItem[] = [
  ...official.map(([artistId, title, videoId, publishedAt, artistName]) => ({
    id: `yt-${videoId}`,
    artistId,
    title: `${artistName} — ${title} (M/V)`,
    type: "Music Video" as const,
    source: "YouTube · JYP Entertainment",
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    category: "Music Videos" as const,
    visual: artistId,
    kind: "official" as const,
    publishedAt,
    videoId,
  })),
  ...(
    [
      ["stray-kids", "Performance", "Favorite Stages"],
      ["day6", "Live", "Favorite Stages"],
      ["nmixx", "Teaser", "Watch Later"],
      ["itzy", "Comeback", "Albums"],
      ["xdinary-heroes", "Announcement", "Watch Later"],
    ] as const
  ).map(([artistId, type, category]) => ({
    id: `demo-${artistId}-${type.toLowerCase()}`,
    artistId,
    title: `演示 · ${type} 内容卡片`,
    type,
    source: "演示占位 · JYP 官方频道入口",
    sourceUrl: "https://www.youtube.com/@JYPEntertainment",
    category,
    visual: artistId,
    kind: "demo" as const,
    publishedAt: null,
  })),
];

export const contentTypes = [
  "All types",
  "Music Video",
  "Performance",
  "Comeback",
  "Teaser",
  "Announcement",
  "Live",
] as const;
export const archiveCategories = [
  "Favorite Stages",
  "Music Videos",
  "Albums",
  "Watch Later",
] as const;
