import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parseEvent, safeEventUrl } from "../../src/calendar/engine.ts";
import { sourceForArtist } from "../../src/data/officialSources.ts";
import { socialForArtist } from "../../src/data/officialSocialAccounts.ts";

export const manualPath = new URL(
  "../../data/calendar/manual-events.json",
  import.meta.url,
);
export function verifiedManualSource(artistId, raw) {
  if (!safeEventUrl(raw, "manual-official")) return false;
  const url = new URL(raw);
  const source = sourceForArtist(artistId);
  const officialRoot = [source?.noticeUrl, source?.scheduleUrl]
    .filter(Boolean)
    .some((root) => {
      const origin = new URL(root);
      return (
        url.hostname === origin.hostname &&
        (url.pathname.startsWith(`${origin.pathname}/`) ||
          (url.pathname === origin.pathname &&
            ["id", "idx", "no"].some((key) => url.searchParams.has(key))))
      );
    });
  const social = socialForArtist(artistId);
  const socialPost =
    social &&
    ["x.com", "twitter.com"].includes(url.hostname) &&
    new RegExp(`^/${social.accountHandle}/status/[0-9]+/?$`, "i").test(
      url.pathname,
    );
  return officialRoot || !!socialPost;
}
export async function readManual(path = manualPath) {
  const body = JSON.parse(await readFile(path, "utf8"));
  if (body.schemaVersion !== 1 || !Array.isArray(body.events))
    throw new Error("Manual event file invalid");
  return body;
}
export function approvedManualEvents(body, artistIds, now) {
  const result = [];
  const ids = new Set();
  for (const item of body.events) {
    if (!item || typeof item.id !== "string" || ids.has(item.id))
      throw new Error("Duplicate or missing manual event id");
    ids.add(item.id);
    if (!artistIds.has(item.artistId))
      throw new Error(`Unknown artist in manual event ${item.id}`);
    if (!["draft", "approved", "rejected"].includes(item.reviewStatus))
      throw new Error(`Invalid review status ${item.id}`);
    if (item.reviewStatus !== "approved") continue;
    if (
      !item.reviewedBy ||
      !item.evidenceUrl ||
      !verifiedManualSource(item.artistId, item.evidenceUrl) ||
      item.sourceUrl !== item.evidenceUrl
    )
      throw new Error(`Manual event ${item.id} lacks verified source evidence`);
    const event = {
      id: `manual-${item.id}`,
      artistId: item.artistId,
      title: item.title,
      eventType: item.eventType,
      source: "manual-official",
      sourceEventId: item.id,
      sourceUrl: item.sourceUrl,
      verification: "verified",
      lifecycle: item.lifecycle,
      startAt: item.startAt,
      endAt: item.endAt,
      localDate: item.localDate,
      localTime: item.localTime,
      timezone: item.timezone,
      timePrecision: item.timePrecision,
      venueName: item.venueName,
      city: item.city,
      country: item.country,
      firstSeenAt: item.firstSeenAt ?? now,
      lastVerifiedAt: item.reviewedAt ?? now,
      updatedAt: item.reviewedAt ?? now,
      sequence: item.sequence ?? 0,
      published: true,
    };
    if (!parseEvent(event, artistIds))
      throw new Error(`Approved manual event ${item.id} failed validation`);
    result.push(event);
  }
  return result;
}

export async function addDraft(
  {
    artistId,
    title,
    eventType,
    localDate,
    sourceUrl,
    timezone,
    startAt,
    localTime,
  },
  artistIds,
  path = manualPath,
) {
  if (
    !artistIds.has(artistId) ||
    !title?.trim() ||
    !verifiedManualSource(artistId, sourceUrl)
  )
    throw new Error("Artist, title or source URL invalid");
  const body = await readManual(path);
  const id = randomUUID();
  body.events.push({
    id,
    artistId,
    title: title.trim(),
    eventType,
    sourceUrl,
    evidenceUrl: sourceUrl,
    lifecycle: "scheduled",
    startAt: startAt || null,
    endAt: null,
    localDate: localDate || null,
    localTime: localTime || null,
    timezone: timezone || null,
    timePrecision: startAt ? "datetime" : localDate ? "date" : "unknown",
    reviewStatus: "draft",
    reviewedBy: null,
    reviewedAt: null,
  });
  await writeFile(path, JSON.stringify(body, null, 2) + "\n");
  return id;
}

export async function reviewDraft(id, reviewer, artistIds, path = manualPath) {
  const body = await readManual(path);
  const entry = body.events.find((item) => item.id === id);
  if (!entry || entry.reviewStatus !== "draft")
    throw new Error("Draft not found");
  if (!reviewer?.trim()) throw new Error("Reviewer required");
  const now = new Date().toISOString();
  const candidate = {
    ...entry,
    reviewStatus: "approved",
    reviewedBy: reviewer.trim(),
    reviewedAt: now,
  };
  approvedManualEvents(
    { schemaVersion: 1, events: [candidate] },
    artistIds,
    now,
  );
  Object.assign(entry, candidate);
  await writeFile(path, JSON.stringify(body, null, 2) + "\n");
}
