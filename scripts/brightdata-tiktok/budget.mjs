import { createHash, randomUUID } from "node:crypto";
import { isInstant } from "../../data/schemas/social.schema.ts";
import {
  BRIGHTDATA_MONTHLY_LIMIT,
  recordCount,
} from "../../data/schemas/brightdata.schema.ts";

export class BrightDataError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function safeBrightDataError(e) {
  return e instanceof BrightDataError && /^[A-Z0-9_]{3,80}$/.test(e.code)
    ? e.code
    : "BRIGHTDATA_OPERATION_FAILED";
}
export function parseLedger(raw) {
  if (
    raw?.schemaVersion !== 1 ||
    !Array.isArray(raw.reservations) ||
    !(
      raw.accountFingerprint === null ||
      /^[a-f0-9]{64}$/.test(raw.accountFingerprint)
    )
  )
    throw new BrightDataError("INVALID_BUDGET_LEDGER");
  const ids = new Set(),
    slots = new Set(),
    totals = new Map();
  for (const r of raw.reservations) {
    const slot = `${r.artistId}:${r.slot}`;
    if (
      typeof r.id !== "string" ||
      ids.has(r.id) ||
      slots.has(slot) ||
      typeof r.artistId !== "string" ||
      !/^\d{4}-\d{2}$/.test(r.month) ||
      typeof r.slot !== "string" ||
      r.slot.length > 100 ||
      !Number.isInteger(r.limit) ||
      r.limit < 1 ||
      r.limit > 8 ||
      !["reserved", "complete", "failed"].includes(r.state) ||
      !isInstant(r.createdAt) ||
      r.createdAt.slice(0, 7) !== r.month ||
      !(r.completedAt === null || isInstant(r.completedAt)) ||
      !(
        r.snapshotId === null ||
        /^s(?:d)?_[A-Za-z0-9]{5,80}$/.test(r.snapshotId)
      ) ||
      !(
        r.recordCount === null ||
        (recordCount(r.recordCount) && r.recordCount <= r.limit)
      ) ||
      (r.state === "complete" &&
        (!r.snapshotId || !r.completedAt || r.recordCount === null))
    )
      throw new BrightDataError("INVALID_BUDGET_LEDGER");
    ids.add(r.id);
    slots.add(slot);
    totals.set(r.month, (totals.get(r.month) ?? 0) + r.limit);
  }
  if (
    [...totals.values()].some((n) => n > BRIGHTDATA_MONTHLY_LIMIT) ||
    (raw.reservations.length && !raw.accountFingerprint)
  )
    throw new BrightDataError("INVALID_BUDGET_LEDGER");
  return raw;
}
export function reservedThisMonth(ledger, month) {
  return ledger.reservations
    .filter((r) => r.month === month)
    .reduce((n, r) => n + r.limit, 0);
}
export function checkPermissionAndBudget(env, ledger, now, requested) {
  if (!env.BRIGHTDATA_API_TOKEN?.trim())
    throw new BrightDataError("BRIGHTDATA_TOKEN_MISSING");
  if (env.BRIGHTDATA_TIKTOK_ENABLED !== "true")
    throw new BrightDataError("BRIGHTDATA_NOT_ENABLED");
  let p;
  try {
    p = JSON.parse(env.BRIGHTDATA_ZERO_COST_APPROVAL_JSON);
  } catch {
    throw new BrightDataError("ZERO_COST_APPROVAL_MISSING");
  }
  const month = now.slice(0, 7),
    used = reservedThisMonth(ledger, month);
  const monthEnd = Date.UTC(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    1,
  );
  // This is an operator's reviewed account evidence, NOT a guessed billing API.
  // It is valid only for an exclusive, unfunded free-tier account with a server
  // hard stop. A local record cap cannot stop a shared/funded account charging.
  if (
    p?.schemaVersion !== 1 ||
    p.month !== month ||
    !isInstant(p.confirmedAt) ||
    !isInstant(p.expiresAt) ||
    Date.parse(p.confirmedAt) > Date.parse(now) ||
    Date.parse(p.expiresAt) <= Date.parse(now) ||
    (requested > 0 && Date.parse(p.expiresAt) < Date.parse(now) + 120000) ||
    Date.parse(p.expiresAt) > monthEnd ||
    p.accountExclusive !== true ||
    p.freeTierEligible !== true ||
    p.depositedBalanceUsd !== 0 ||
    p.autoRecharge !== false ||
    p.serverFreeTierHardStop !== true ||
    p.paidSpendLimitUsd !== 0 ||
    p.publicMetadataUseApproved !== true ||
    typeof p.permissionEvidenceRef !== "string" ||
    !p.permissionEvidenceRef.trim() ||
    typeof p.billingEvidenceRef !== "string" ||
    !p.billingEvidenceRef.trim() ||
    typeof p.accountRef !== "string" ||
    !p.accountRef.trim() ||
    !recordCount(p.freeCreditsRemaining) ||
    !recordCount(p.baselineReservedRecords) ||
    p.baselineReservedRecords > used
  )
    throw new BrightDataError("ZERO_COST_OR_USE_PERMISSION_UNCONFIRMED");
  const fingerprint = createHash("sha256").update(p.accountRef).digest("hex");
  if (ledger.accountFingerprint && ledger.accountFingerprint !== fingerprint)
    throw new BrightDataError("BUDGET_ACCOUNT_MISMATCH");
  if (ledger.reservations.some((r) => r.state === "reserved"))
    throw new BrightDataError("UNRESOLVED_PROVIDER_JOB");
  const remaining = Math.min(
    BRIGHTDATA_MONTHLY_LIMIT - used,
    p.freeCreditsRemaining - (used - p.baselineReservedRecords),
  );
  if (remaining < requested)
    throw new BrightDataError("FREE_RECORD_BUDGET_EXHAUSTED");
  return { month, used, remaining, fingerprint, expiresAt: p.expiresAt };
}
export function reserve(ledger, account, slot, limit, now, fingerprint) {
  if (
    ledger.reservations.some(
      (r) => r.artistId === account.artistId && r.slot === slot,
    )
  )
    throw new BrightDataError("SLOT_ALREADY_RESERVED");
  if (
    reservedThisMonth(ledger, now.slice(0, 7)) + limit >
    BRIGHTDATA_MONTHLY_LIMIT
  )
    throw new BrightDataError("FREE_RECORD_BUDGET_EXHAUSTED");
  ledger.accountFingerprint = fingerprint;
  const reservation = {
    id: randomUUID(),
    artistId: account.artistId,
    slot,
    month: now.slice(0, 7),
    limit,
    state: "reserved",
    snapshotId: null,
    recordCount: null,
    createdAt: now,
    completedAt: null,
  };
  ledger.reservations.push(reservation);
  parseLedger(ledger);
  return reservation;
}
export function checkSlot(now, mode, supplied) {
  if (mode === "probe") return `probe:${now.slice(0, 10)}`;
  const date = new Date(now),
    hour = date.getUTCHours();
  const slot = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour < 12 ? 0 : 12,
    ),
  ).toISOString();
  if (supplied && supplied !== slot)
    throw new BrightDataError("INVALID_SCHEDULE_SLOT");
  return slot;
}
