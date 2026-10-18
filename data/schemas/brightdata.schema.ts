import { isInstant, type SocialAccount } from "./social.schema.ts";

export const BRIGHTDATA_DATASET = "gd_lu702nij2f790tmv9h";
export const BRIGHTDATA_PROVIDER = "brightdata-tiktok-posts";
export const BRIGHTDATA_MONTHLY_LIMIT = 4000;
export const TIKTOK_AUTO_ARTISTS = [
  "twice",
  "stray-kids",
  "nmixx",
  "nexz",
  "itzy",
  "niziu",
] as const;
export function selectAutomaticAccounts(accounts: SocialAccount[]) {
  return TIKTOK_AUTO_ARTISTS.map((id) => {
    const matches = accounts.filter(
      (a) =>
        a.platform === "tiktok" &&
        a.artistId === id &&
        a.verificationStatus === "verified",
    );
    if (matches.length !== 1)
      throw new Error("INVALID_VERIFIED_ACCOUNT_COVERAGE");
    return matches[0];
  });
}
export type BrightDataSource = {
  artistId: string;
  accountUrl: string;
  state: "not-configured" | "blocked" | "ok" | "failed" | "skipped";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastContentChangeAt: string | null;
  newCount: number | null;
  updatedCount: number | null;
  returnedCount: number | null;
  error: string | null;
};
export type BrightDataStatus = {
  schemaVersion: 1;
  provider: typeof BRIGHTDATA_PROVIDER;
  datasetId: typeof BRIGHTDATA_DATASET;
  schedule: "0 0,12 * * *";
  budget: {
    month: string | null;
    recordLimit: number;
    reservedRecords: number;
    deliveredRecords: number;
    remainingRecords: number | null;
    paidSpendLimitUsd: 0;
    // Provider billing is not measured by the local reservation ledger.
    paidSpendUsd: null;
    confirmationValidUntil: string | null;
  };
  sources: BrightDataSource[];
};
export const recordCount = (x: unknown): x is number =>
  Number.isSafeInteger(x) && Number(x) >= 0;
export function parseBrightDataStatus(
  raw: unknown,
  accounts: SocialAccount[],
): BrightDataStatus | null {
  try {
    const r = raw as BrightDataStatus,
      b = r.budget;
    const targets = selectAutomaticAccounts(accounts);
    if (
      r.schemaVersion !== 1 ||
      r.provider !== BRIGHTDATA_PROVIDER ||
      r.datasetId !== BRIGHTDATA_DATASET ||
      r.schedule !== "0 0,12 * * *" ||
      !b ||
      !(b.month === null || /^\d{4}-\d{2}$/.test(b.month)) ||
      b.recordLimit !== BRIGHTDATA_MONTHLY_LIMIT ||
      !recordCount(b.reservedRecords) ||
      !recordCount(b.deliveredRecords) ||
      b.reservedRecords > b.recordLimit ||
      b.deliveredRecords > b.reservedRecords ||
      !(
        b.remainingRecords === null ||
        (recordCount(b.remainingRecords) &&
          b.remainingRecords <= b.recordLimit - b.reservedRecords)
      ) ||
      b.paidSpendLimitUsd !== 0 ||
      b.paidSpendUsd !== null ||
      !(
        b.confirmationValidUntil === null || isInstant(b.confirmationValidUntil)
      ) ||
      !Array.isArray(r.sources) ||
      r.sources.length !== targets.length
    )
      return null;
    const seen = new Set<string>();
    for (const s of r.sources) {
      const a = targets.find((a) => a.artistId === s.artistId);
      if (
        !a ||
        a.accountUrl !== s.accountUrl ||
        seen.has(s.artistId) ||
        !["not-configured", "blocked", "ok", "failed", "skipped"].includes(
          s.state,
        ) ||
        ![s.lastAttemptAt, s.lastSuccessAt, s.lastContentChangeAt].every(
          (t) => t === null || isInstant(t),
        ) ||
        ![s.newCount, s.updatedCount, s.returnedCount].every(
          (n) => n === null || recordCount(n),
        ) ||
        !(
          s.error === null ||
          (typeof s.error === "string" && /^[A-Z0-9_]{3,80}$/.test(s.error))
        ) ||
        (s.state === "ok" &&
          (!s.lastSuccessAt ||
            s.newCount === null ||
            s.updatedCount === null ||
            s.returnedCount === null)) ||
        (s.lastSuccessAt &&
          (!s.lastAttemptAt ||
            (Date.parse(s.lastSuccessAt) < Date.parse(s.lastAttemptAt) &&
              s.state === "ok"))) ||
        (s.lastContentChangeAt &&
          (!s.lastSuccessAt ||
            Date.parse(s.lastContentChangeAt) > Date.parse(s.lastSuccessAt)))
      )
        return null;
      seen.add(s.artistId);
    }
    return r;
  } catch {
    return null;
  }
}

export function brightDataOverdue(source: BrightDataSource, now = Date.now()) {
  if (!source.lastSuccessAt) return source.state === "ok";
  // 08:00 / 20:00 Beijing, with one hour grace; compare to the actual due slot.
  const hour = 3600000,
    day = 24 * hour;
  const utcDay = Math.floor(now / day) * day;
  const slot = [utcDay - 12 * hour, utcDay, utcDay + 12 * hour]
    .filter((t) => t + hour <= now)
    .at(-1)!;
  return Date.parse(source.lastSuccessAt) < slot;
}
