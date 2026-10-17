import type {
  SocialContent,
  SocialPlatform,
} from "../../data/schemas/social.schema";
export type SocialKind = "videos" | "reels" | "video-post" | "post" | "all";
export function selectSocialContent(
  items: SocialContent[],
  {
    artistId,
    platform,
    search = "",
    kind = "videos",
  }: {
    artistId: string;
    platform: SocialPlatform;
    search?: string;
    kind?: SocialKind;
  },
) {
  const needle = search.trim().toLocaleLowerCase();
  return items
    .filter((i) => {
      const matchesKind =
        kind === "all" ||
        (kind === "videos" ? i.contentType !== "post" : i.contentType === kind);
      return (
        i.artistId === artistId &&
        i.platform === platform &&
        matchesKind &&
        `${i.title ?? ""} ${i.description ?? ""} ${i.id} ${i.artistId.replaceAll("-", " ")} ${i.platform} ${i.contentType}`
          .toLocaleLowerCase()
          .includes(needle)
      );
    })
    .sort((a, b) =>
      a.publishedAt && b.publishedAt
        ? Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
        : a.publishedAt
          ? -1
          : b.publishedAt
            ? 1
            : 0,
    );
}
