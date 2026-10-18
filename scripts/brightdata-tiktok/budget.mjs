import { createHash, randomUUID } from "node:crypto";
import { isInstant } from "../../data/schemas/social.schema.ts";
import {
  BRIGHTDATA_MONTHLY_LIMIT,
  BRIGHTDATA_DATASET,
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
        (!r.snapshotId || !r.completedAt || r.recordCount === null)) ||
      (r.creditLimit !== undefined &&
        (!Number.isFinite(r.creditLimit) ||
          r.creditLimit <= 0 ||
          !["itzy-probe-once", "scheduled-free-only"].includes(r.purpose))) ||
      (r.purpose !== undefined && r.creditLimit === undefined) ||
      (r.purpose === "itzy-probe-once" &&
        (r.artistId !== "itzy" ||
          r.limit !== 1 ||
          !r.slot.startsWith("probe:")))
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
export function checkPermissionAndBudget(
  env,
  ledger,
  now,
  requested,
  context = {},
) {
  if (!env.BRIGHT_DATA_API_KEY?.trim())
    throw new BrightDataError("BRIGHTDATA_TOKEN_MISSING");
  if (env.BRIGHTDATA_TIKTOK_ENABLED !== "true")
    throw new BrightDataError("BRIGHTDATA_NOT_ENABLED");
  let p;
  try {
    p = JSON.parse(env.BRIGHTDATA_ZERO_COST_APPROVAL_JSON);
  } catch {
    throw new BrightDataError("ZERO_COST_APPROVAL_MISSING");
  }
  if (p?.schemaVersion === 2)
    return checkScopedFreeOnly(p, ledger, now, requested, context);
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
  if (
    context.mode === "probe" &&
    requested > 0 &&
    ledger.reservations.some(
      (r) => r.artistId === "itzy" && r.slot.startsWith("probe:"),
    )
  )
    throw new BrightDataError("PROBE_ALREADY_RESERVED");
  const remaining = Math.min(
    BRIGHTDATA_MONTHLY_LIMIT - used,
    p.freeCreditsRemaining - (used - p.baselineReservedRecords),
  );
  if (remaining < requested)
    throw new BrightDataError("FREE_RECORD_BUDGET_EXHAUSTED");
  return { month, used, remaining, fingerprint, expiresAt: p.expiresAt };
}

const amount = (x) => x === null || (Number.isFinite(x) && x >= 0);
export function reservedCredits(ledger, month) {
  return ledger.reservations
    .filter((r) => r.month === month)
    .reduce((n, r) => n + (r.creditLimit ?? 0), 0);
}
function checkScopedFreeOnly(p, ledger, now, requested, context) {
  const a = p.authorization,
    b = p.balance;
  const month = now.slice(0, 7),
    used = reservedThisMonth(ledger, month);
  const credits = reservedCredits(ledger, month);
  const legacy = ledger.reservations
    .filter((r) => r.month === month && r.creditLimit === undefined)
    .reduce((n, r) => n + r.limit, 0);
  const monthEnd = Date.UTC(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    1,
  );
  // A reported absence of a payment method is retained as reported evidence.
  // The provider documents that auto-recharge requires a verified method;
  // there is no API for reading that setting. Do not invent a false observation.
  const noPaymentMethod =
    p.noPaymentMethodReported === true &&
    ["none-reported", "none-confirmed"].includes(p.paymentMethod);
  const renewed =
    a?.scope === "scheduled-free-only" &&
    p.recurringMonthlyFreeTier === true &&
    noPaymentMethod &&
    p.monthlyFreeTierEvidenceRef ===
      "https://docs.brightdata.com/general/account/billing-and-pricing/free-tier" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) &&
    p.month < month &&
    p.freeCredits?.total === 5000;
  // Renewal is an explicitly approved published allowance, not a fresh account
  // observation. Preserve the original figures in the report. Paid fallbacks,
  // exhausted budgets and unresolved jobs still stop collection.
  const f = renewed
    ? { remaining: 5000, total: 5000, unit: "credits" }
    : p.freeCredits;
  const expiresAt = renewed ? new Date(monthEnd).toISOString() : p.expiresAt;
  const baselineCredits = renewed ? 0 : p.baselineReservedCredits;
  const baselineLegacy = renewed ? 0 : p.baselineLegacyReservedRecords;
  const holdback = p.holdbackCredits ?? 0;
  if (
    (!renewed && p.month !== month) ||
    !isInstant(p.confirmedAt) ||
    !isInstant(p.expiresAt) ||
    Date.parse(p.confirmedAt) > Date.parse(now) ||
    Date.parse(p.expiresAt) <= Date.parse(p.confirmedAt) ||
    Date.parse(expiresAt) <= Date.parse(now) ||
    (requested > 0 && Date.parse(expiresAt) < Date.parse(now) + 120000) ||
    Date.parse(expiresAt) > monthEnd ||
    !recordCount(requested) ||
    typeof p.accountRef !== "string" ||
    !p.accountRef.trim() ||
    p.accountExclusive !== true ||
    p.publicMetadataUseApproved !== true ||
    typeof p.permissionEvidenceRef !== "string" ||
    !p.permissionEvidenceRef.trim() ||
    !recordCount(f?.remaining) ||
    !recordCount(f?.total) ||
    f.remaining > f.total ||
    f.unit !== "credits" ||
    !recordCount(holdback) ||
    holdback > f.remaining ||
    !amount(b?.amountUsd) ||
    !["unknown", "bonus", "deposited"].includes(b?.kind) ||
    !amount(p.cashSpend?.amountUsd) ||
    ![null, false].includes(p.autoRecharge) ||
    !["none-reported", "none-confirmed", "unknown", "present"].includes(
      p.paymentMethod,
    ) ||
    !Number.isFinite(baselineCredits) ||
    baselineCredits < 0 ||
    baselineCredits > credits ||
    !recordCount(baselineLegacy) ||
    baselineLegacy !== legacy ||
    p.paidSpendLimitUsd !== 0
  )
    throw new BrightDataError("INVALID_SCOPED_ZERO_COST_APPROVAL");
  // Balance and cash observations are independent. Unknown origin is retained,
  // not converted to zero. Only a scoped provider-backed free-only guarantee authorizes spending.
  if (
    a?.approved !== true ||
    a.datasetId !== BRIGHTDATA_DATASET ||
    !["itzy-probe-once", "scheduled-free-only"].includes(a.scope) ||
    typeof a.evidenceRef !== "string" ||
    !a.evidenceRef.trim() ||
    a.freeOnlyHardStopConfirmed !== true ||
    a.noBalanceDebitConfirmed !== true ||
    a.noCashChargeConfirmed !== true ||
    a.noAutomaticRechargeConfirmed !== true ||
    !Number.isFinite(a.maxCreditsPerRecord) ||
    a.maxCreditsPerRecord <= 0
  )
    throw new BrightDataError("FREE_ONLY_GUARANTEE_MISSING");
  if (a.scope === "itzy-probe-once") {
    if (
      context.mode !== "probe" ||
      context.artist !== "itzy" ||
      context.limit !== 1 ||
      requested > 1
    )
      throw new BrightDataError("ZERO_COST_SCOPE_MISMATCH");
  } else if (
    context.mode !== "sync" ||
    !(p.autoRecharge === false || (p.autoRecharge === null && noPaymentMethod))
  )
    throw new BrightDataError("SCHEDULE_ZERO_COST_APPROVAL_REQUIRED");
  const fingerprint = createHash("sha256").update(p.accountRef).digest("hex");
  if (ledger.accountFingerprint && ledger.accountFingerprint !== fingerprint)
    throw new BrightDataError("BUDGET_ACCOUNT_MISMATCH");
  if (ledger.reservations.some((r) => r.state === "reserved"))
    throw new BrightDataError("UNRESOLVED_PROVIDER_JOB");
  if (
    a.scope === "itzy-probe-once" &&
    requested > 0 &&
    ledger.reservations.some(
      (r) => r.artistId === "itzy" && r.slot.startsWith("probe:"),
    )
  )
    throw new BrightDataError("PROBE_ALREADY_RESERVED");
  const remainingCredits = f.remaining - holdback - (credits - baselineCredits);
  const remaining = Math.min(
    BRIGHTDATA_MONTHLY_LIMIT - used,
    Math.floor(remainingCredits / a.maxCreditsPerRecord),
  );
  if (remaining < requested)
    throw new BrightDataError("FREE_RECORD_BUDGET_EXHAUSTED");
  return {
    month,
    used,
    remaining,
    fingerprint,
    expiresAt,
    purpose: a.scope,
    creditsPerRecord: a.maxCreditsPerRecord,
    observation: {
      freeCredits: { ...p.freeCredits },
      balance: { amountUsd: b.amountUsd, kind: b.kind },
      cashSpend: { amountUsd: p.cashSpend.amountUsd },
      paymentMethod: p.paymentMethod,
      autoRecharge: p.autoRecharge,
      source: "maintainer-reported",
      observedAt: p.confirmedAt,
      budgetAllowance: {
        month,
        creditsAtBaseline: f.remaining,
        holdbackCredits: holdback,
        source: renewed
          ? "documented-monthly-renewal-not-account-read"
          : "reported-baseline",
      },
    },
  };
}

export function reserve(
  ledger,
  account,
  slot,
  limit,
  now,
  fingerprint,
  authorization = null,
) {
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
    ...(authorization?.purpose
      ? {
          purpose: authorization.purpose,
          creditLimit: limit * authorization.creditsPerRecord,
        }
      : {}),
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
