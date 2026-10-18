// Import an already captured provider snapshot. No API calls, credentials or CDN URLs.
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadSocial, loadSocialAccounts } from "../social-sync/index.mjs";
import { atomicJson } from "../sync-status.mjs";
import {
  canonicalAccount,
  isInstant,
  parseSocialSnapshot,
  socialIdentity,
} from "../../data/schemas/social.schema.ts";
import { normalizeRows, mergeBrightData } from "./adapter.mjs";
import { safeBrightDataError } from "./budget.mjs";

const providerFailure = (code) =>
  code === "dead_page"
    ? "PROVIDER_DEAD_PAGE"
    : code === "wait_element_timeout"
      ? "PROVIDER_WAIT_ELEMENT_TIMEOUT"
      : "PROVIDER_RECORD_ERROR";
const failureEvidence = (row, account) => {
  const sourceUrl = row?.input?.url;
  const identity =
    typeof sourceUrl === "string" ? socialIdentity("tiktok", sourceUrl) : null;
  return {
    ...(identity?.handle === account.handle.toLowerCase() ? { sourceUrl } : {}),
    ...(isInstant(row?.timestamp) ? { capturedAt: row.timestamp } : {}),
  };
};

export function prepareFileImport(rows, accounts, snapshot, snapshotId) {
  if (
    !Array.isArray(rows) ||
    rows.length > 10000 ||
    !/^s(?:d)?_[A-Za-z0-9]{5,80}$/.test(snapshotId)
  )
    throw Error("Invalid snapshot file or snapshot ID");
  const targets = accounts.filter((a) => a.platform === "tiktok");
  const summary = Object.fromEntries(
    targets.map((a) => [
      a.artistId,
      {
        handle: a.handle,
        rows: 0,
        valid: 0,
        duplicate: 0,
        new: 0,
        updated: 0,
        enriched: 0,
        newestCapturedAt: null,
        newestPublishedAt: null,
        failures: [],
      },
    ]),
  );
  const accepted = new Map();
  const conflicted = new Set();
  const unknown = [];
  for (const [index, row] of rows.entries()) {
    const sourceAccount = canonicalAccount(
      "tiktok",
      row?.discovery_input?.url ?? "",
    );
    const account = targets.find((a) => a.accountUrl === sourceAccount);
    if (!account) {
      unknown.push({ index, code: "UNKNOWN_DISCOVERY_ACCOUNT" });
      continue;
    }
    const stat = summary[account.artistId];
    stat.rows++;
    if (
      isInstant(row.timestamp) &&
      (!stat.newestCapturedAt ||
        Date.parse(row.timestamp) > Date.parse(stat.newestCapturedAt))
    )
      stat.newestCapturedAt = row.timestamp;
    if (row.error || row.error_code) {
      stat.failures.push({
        index,
        code: providerFailure(row.error_code),
        ...failureEvidence(row, account),
      });
      continue;
    }
    try {
      // The capture time is the evidence time. Do not relabel old data as fresh.
      if (!isInstant(row.timestamp)) throw Error("INVALID_CAPTURE_TIME");
      const item = normalizeRows([row], account, {
        snapshotId,
        now: row.timestamp,
        limit: 1,
      })[0];
      if (conflicted.has(item.id)) {
        stat.failures.push({ index, code: "CONFLICTING_DUPLICATE_ID" });
        continue;
      }
      const previous = accepted.get(item.id);
      if (previous) {
        if (
          previous.item.artistId !== item.artistId ||
          previous.item.sourceUrl !== item.sourceUrl ||
          previous.item.publishedAt !== item.publishedAt
        ) {
          accepted.delete(item.id);
          conflicted.add(item.id);
          stat.failures.push({ index, code: "CONFLICTING_DUPLICATE_ID" });
          summary[previous.item.artistId].valid--;
          summary[previous.item.artistId].failures.push({
            index: previous.index,
            code: "CONFLICTING_DUPLICATE_ID",
          });
        } else stat.duplicate++;
        continue;
      }
      accepted.set(item.id, { item, index });
      stat.valid++;
      if (
        !stat.newestPublishedAt ||
        Date.parse(item.publishedAt) > Date.parse(stat.newestPublishedAt)
      )
        stat.newestPublishedAt = item.publishedAt;
    } catch (error) {
      // Never print a raw provider error, URL or signed media link.
      const code =
        error.message === "INVALID_CAPTURE_TIME"
          ? "INVALID_CAPTURE_TIME"
          : safeBrightDataError(error);
      stat.failures.push({ index, code });
    }
  }
  const incoming = [...accepted.values()].map(({ item }) => item);
  const old = new Map(snapshot.items.map((item) => [item.id, item]));
  const merged = mergeBrightData(snapshot, incoming);
  const next = new Map(merged.snapshot.items.map((item) => [item.id, item]));
  if (!parseSocialSnapshot(merged.snapshot, "tiktok", accounts))
    throw Error("Merged TikTok manifest failed validation");
  for (const item of incoming) {
    const stat = summary[item.artistId];
    if (!old.has(item.id)) stat.new++;
    else {
      if (old.get(item.id).publishedAt !== next.get(item.id).publishedAt)
        stat.updated++;
      if (
        !old.get(item.id).thirdPartyEvidence &&
        next.get(item.id).thirdPartyEvidence
      )
        stat.enriched++;
    }
  }
  return {
    manifest: merged.snapshot,
    report: {
      snapshotId,
      totalRows: rows.length,
      accepted: incoming.length,
      unknown,
      accounts: summary,
    },
  };
}

export async function importSnapshotFile({
  file,
  root = resolve("data"),
  write = false,
}) {
  if (!file) throw Error("--file is required");
  const match = basename(file).match(
    /^(s(?:d)?_[A-Za-z0-9]{5,80})(?: \(\d+\))?\.json$/,
  );
  if (!match) throw Error("File name must contain a Bright Data snapshot ID");
  const raw = await readFile(resolve(file));
  if (raw.length > 10 * 1024 * 1024) throw Error("Snapshot file exceeds 10 MB");
  const rows = JSON.parse(raw.toString("utf8"));
  const accounts = await loadSocialAccounts(root);
  const snapshot = await loadSocial("tiktok", accounts, root);
  const result = prepareFileImport(rows, accounts, snapshot, match[1]);
  const changed = JSON.stringify(snapshot) !== JSON.stringify(result.manifest);
  if (write && changed && result.report.accepted > 0)
    await atomicJson(
      resolve(root, "social/tiktok/items.json"),
      result.manifest,
    );
  return {
    ...result.report,
    wroteManifest: write && changed && result.report.accepted > 0,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const file = process.argv.find((arg) => arg.startsWith("--file="))?.slice(7);
  const write = process.argv.includes("--write");
  try {
    if (
      process.argv
        .slice(2)
        .some((arg) => arg !== "--write" && !arg.startsWith("--file="))
    )
      throw Error("Use --file=PATH and optionally --write");
    console.log(
      JSON.stringify(await importSnapshotFile({ file, write }), null, 2),
    );
  } catch (error) {
    const safeMessages = new Set([
      "--file is required",
      "Use --file=PATH and optionally --write",
      "File name must contain a Bright Data snapshot ID",
      "Snapshot file exceeds 10 MB",
      "Invalid snapshot file or snapshot ID",
      "Merged TikTok manifest failed validation",
    ]);
    console.error(
      JSON.stringify({
        error: safeMessages.has(error.message)
          ? error.message
          : "BRIGHTDATA_FILE_IMPORT_FAILED",
      }),
    );
    process.exitCode = 1;
  }
}
