// Conservative project retention, not a claim that either platform grants a
// universal 30-day licence. Operators must also meet their app's actual terms.
export const API_RETENTION_MS = 30 * 86400000;
export function expireApiMetadata(snapshot, now) {
  let prunedCount = 0;
  const items = snapshot.items.flatMap((item) => {
    if (item.thirdPartyEvidence && Date.parse(now)-Date.parse(item.thirdPartyEvidence.checkedAt)>=API_RETENTION_MS) {
      prunedCount++;
      if(item.acquisitionMethod === 'third-party-api') return [];
      const {thirdPartyEvidence: _thirdParty, ...rest}=item;
      item=rest;
    }
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
