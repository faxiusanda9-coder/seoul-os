// Official API metadata keeps its existing refresh policy. Third-party records
// store only a minimal post index, not copied media/captions. Do not discard
// historical IDs just because they are absent from an eight-post recent window.
// Operators must confirm actual indexing/retention permission before enabling.
export const API_RETENTION_MS = 30 * 86400000;
export function expireApiMetadata(snapshot, now) {
  let prunedCount = 0;
  const items = snapshot.items.flatMap((item) => {
    if (
      !item.apiEvidence ||
      Date.parse(now) - Date.parse(item.apiEvidence.checkedAt) <
        API_RETENTION_MS
    )
      return [item];
    prunedCount++;
    if (item.acquisitionMethod === "api") return [];
    const { apiEvidence: _proof, ...manual } = item;
    return [manual]; // API enrichment never overwrites the original manual metadata.
  });
  return { snapshot: { ...snapshot, items }, prunedCount };
}
