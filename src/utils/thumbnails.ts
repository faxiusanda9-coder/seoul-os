import type { ThumbnailVariant } from "../../data/schemas/content.schema";

/** Only variants reported by videos.list enter the responsive set. */
export function responsiveThumbnail(variants: ThumbnailVariant[], legacyUrl?: string) {
  const available = [...variants].sort((a, b) => a.width - b.width);
  const sameShape = available.filter((item) => Math.abs(item.width / item.height - 16 / 9) < 0.06);
  // When no second 16:9 option exists, preserve every API variant; contain keeps
  // the original pixels and ratio intact even if YouTube supplies a 4:3 image.
  const responsive = sameShape.length > 1 ? sameShape : available;
  const initial = responsive[0] ?? available.find((item) => item.width >= 320) ?? available[0];
  const urls = [...new Set([...(initial ? [initial.url] : []), ...available.map((item) => item.url), ...(legacyUrl ? [legacyUrl] : [])])];
  return { urls, srcSet: responsive.map((item) => `${item.url} ${item.width}w`).join(", ") };
}
