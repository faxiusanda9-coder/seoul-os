import {
  BRIGHTDATA_DATASET,
  BRIGHTDATA_PROVIDER,
} from "../../data/schemas/brightdata.schema.ts";
import {
  canonicalAccount,
  socialIdentity,
  isInstant,
  safeHttps,
} from "../../data/schemas/social.schema.ts";
import { BrightDataError } from "./budget.mjs";

const origin = "https://api.brightdata.com";
const snapshotId = (value) =>
  typeof value === "string" && /^s(?:d)?_[A-Za-z0-9]{5,80}$/.test(value);
export function failedRowEvidence(rows, account, id) {
  return rows.flatMap((row, index) => {
    if (!row?.error && !row?.error_code) return [];
    const url = row.input?.url,
      identity = typeof url === "string" ? socialIdentity("tiktok", url) : null;
    return [
      {
        index,
        artistId: account.artistId,
        snapshotId: id,
        code:
          row.error_code === "dead_page"
            ? "PROVIDER_DEAD_PAGE"
            : row.error_code === "wait_element_timeout"
              ? "PROVIDER_WAIT_ELEMENT_TIMEOUT"
              : "PROVIDER_RECORD_ERROR",
        ...(identity?.handle === account.handle.toLowerCase()
          ? { sourceUrl: url }
          : {}),
        ...(isInstant(row.timestamp) ? { capturedAt: row.timestamp } : {}),
      },
    ];
  });
}
export function triggerRequest(account, limit) {
  if (
    account.platform !== "tiktok" ||
    account.verificationStatus !== "verified" ||
    canonicalAccount("tiktok", account.accountUrl) !== account.accountUrl ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 8
  )
    throw new BrightDataError("INVALID_VERIFIED_TARGET");
  const params = new URLSearchParams({
    dataset_id: BRIGHTDATA_DATASET,
    type: "discover_new",
    discover_by: "profile_url",
    include_errors: "true",
    format: "json",
    limit_multiple_results: String(limit),
  });
  return {
    url: `${origin}/datasets/v3/trigger?${params}`,
    body: {
      input: [
        {
          url: account.accountUrl,
          num_of_posts: limit,
          include_pinned_post: false,
        },
      ],
      limit_per_input: limit,
    },
  };
}
export async function providerJson(
  path,
  {
    token,
    fetcher = fetch,
    method = "GET",
    body,
    deadline = Date.now() + 30000,
  },
) {
  const url = new URL(path, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/datasets/v3/"))
    throw new BrightDataError("INVALID_PROVIDER_ENDPOINT");
  let response;
  try {
    response = await fetcher(url.href, {
      method,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(
        Math.max(1, Math.min(30000, deadline - Date.now())),
      ),
    });
  } catch {
    throw new BrightDataError("BRIGHTDATA_NETWORK_OR_TIMEOUT");
  }
  if (!response.ok)
    throw new BrightDataError(`BRIGHTDATA_HTTP_${response.status}`);
  // No redirects, no raw provider errors in logs, bounded JSON metadata only.
  const max = 1024 * 1024;
  if (Number(response.headers.get("content-length")) > max)
    throw new BrightDataError("BRIGHTDATA_RESPONSE_TOO_LARGE");
  let size = 0,
    chunks = [];
  if (!response.body) throw new BrightDataError("BRIGHTDATA_INVALID_JSON");
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new BrightDataError("BRIGHTDATA_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    if (e instanceof BrightDataError) throw e;
    throw new BrightDataError("BRIGHTDATA_INVALID_JSON");
  }
}
export async function collectProfile(
  account,
  {
    limit = 8,
    token,
    fetcher = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    onSnapshot = async () => {},
    onTerminal = async () => {},
    onRows = async () => {},
    onUnknownState = async () => {},
    maxPolls = 360,
  } = {},
) {
  const request = triggerRequest(account, limit),
    deadline = Date.now() + 1800000;
  // Never retry POST: a timeout does not prove the provider did not create a job.
  const started = await providerJson(request.url, {
    token,
    fetcher,
    method: "POST",
    body: request.body,
    deadline,
  });
  if (!snapshotId(started.snapshot_id))
    throw new BrightDataError("BRIGHTDATA_INVALID_SNAPSHOT");
  const id = started.snapshot_id;
  await onSnapshot(id);
  let unknownPolls = 0;
  for (let n = 0; n < maxPolls && Date.now() < deadline; n++) {
    const progress = await providerJson(`/datasets/v3/progress/${id}`, {
      token,
      fetcher,
      deadline,
    });
    if (
      progress.snapshot_id !== id ||
      progress.dataset_id !== BRIGHTDATA_DATASET
    )
      throw new BrightDataError("BRIGHTDATA_SNAPSHOT_IDENTITY_MISMATCH");
    if (["failed", "canceled"].includes(progress.status)) {
      await onTerminal("failed");
      throw new BrightDataError(
        progress.status === "failed"
          ? "BRIGHTDATA_JOB_FAILED"
          : "BRIGHTDATA_JOB_CANCELED",
      );
    }
    if (progress.status === "ready") {
      const rows = await providerJson(
        `/datasets/v3/snapshot/${id}?format=json`,
        { token, fetcher, deadline },
      );
      await onRows(rows);
      if (!Array.isArray(rows) || rows.length > limit)
        throw new BrightDataError("BRIGHTDATA_RESULT_LIMIT_OR_FORMAT");
      return { snapshotId: id, rows };
    }
    if (!["starting", "running"].includes(progress.status)) {
      // A real job briefly returned an undocumented state before becoming
      // ready. Re-read the SAME job for at most one minute. Unknown is never
      // considered success, never downloaded, and never causes another POST.
      await onUnknownState(
        typeof progress.status === "string" &&
          /^[a-z_-]{1,32}$/.test(progress.status)
          ? progress.status
          : "unrecognized-value",
      );
      if (++unknownPolls >= 13 || n + 1 >= maxPolls)
        throw new BrightDataError("BRIGHTDATA_UNKNOWN_JOB_STATE");
    } else unknownPolls = 0;
    if (n + 1 < maxPolls)
      await sleep(Math.min(5000, Math.max(1, deadline - Date.now())));
  }
  throw new BrightDataError("BRIGHTDATA_JOB_TIMEOUT");
}
export function normalizeRows(
  rows,
  account,
  { snapshotId: id, now, limit = 8 },
) {
  if (
    !snapshotId(id) ||
    !isInstant(now) ||
    !Array.isArray(rows) ||
    rows.length > limit
  )
    throw new BrightDataError("BRIGHTDATA_RESULT_LIMIT_OR_FORMAT");
  const seen = new Map();
  for (const row of rows) {
    if (!row || row.error || row.error_code)
      throw new BrightDataError("BRIGHTDATA_RECORD_ERROR");
    if (
      typeof row.post_id !== "string" ||
      !/^\d{15,25}$/.test(row.post_id) ||
      !safeHttps(row.url)
    )
      throw new BrightDataError("BRIGHTDATA_INVALID_VIDEO_ID");
    const u = new URL(row.url);
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname.replace(/\/$/, "");
    const identity = socialIdentity("tiktok", u.href),
      handle = account.handle.toLowerCase();
    if (
      !identity ||
      identity.id !== `tt-${row.post_id}` ||
      identity.handle !== handle ||
      // Bright Data's profile_username is the display name (for example
      // "ITZY"), while account_id and profile_url identify the handle.
      typeof row.account_id !== "string" ||
      row.account_id.toLowerCase() !== handle ||
      typeof row.profile_username !== "string" ||
      !row.profile_username.trim() ||
      canonicalAccount("tiktok", row.profile_url) !== account.accountUrl ||
      (row.discovery_input?.url &&
        canonicalAccount("tiktok", row.discovery_input.url) !==
          account.accountUrl)
    )
      throw new BrightDataError("BRIGHTDATA_AUTHOR_MISMATCH");
    if (
      !isInstant(row.create_time) ||
      Date.parse(row.create_time) < Date.parse("2016-01-01T00:00:00Z") ||
      Date.parse(row.create_time) > Date.parse(now) + 300000
    )
      throw new BrightDataError("BRIGHTDATA_INVALID_PUBLICATION_TIME");
    if (row.post_type !== "video" || (row.carousel_images?.length ?? 0) > 0)
      throw new BrightDataError("BRIGHTDATA_NOT_A_VIDEO");
    const item = {
      id: identity.id,
      artistId: account.artistId,
      platform: "tiktok",
      contentType: "short-video",
      title: null,
      description: null,
      thumbnail: null,
      publishedAt: row.create_time,
      sourceUrl: u.href,
      embedUrl: identity.embedUrl,
      officialAccountUrl: account.accountUrl,
      verificationStatus: "account-matched",
      acquisitionMethod: "third-party-api",
      fetchedAt: now,
      lastValidatedAt: now,
      availabilityStatus: "unknown",
      sourceAvailability: "unknown",
      embedAvailability: "untested",
      evidenceUrl: account.evidenceUrl,
      evidenceNote:
        "账号归属来自已核实的官方交叉链接；视频元数据由 Bright Data 第三方接口返回并核对作者，不代表 TikTok 官方 API 授权或实际播放成功。",
      reviewedBy: "system:brightdata-author-match",
      thirdPartyEvidence: {
        provider: BRIGHTDATA_PROVIDER,
        datasetId: BRIGHTDATA_DATASET,
        snapshotId: id,
        videoId: row.post_id,
        authorHandle: handle,
        authorProfileUrl: account.accountUrl,
        originalUrl: row.url,
        rawCreateTime: row.create_time,
        accountEvidenceUrl: account.evidenceUrl,
        checkedAt: now,
      },
    };
    if (
      seen.has(item.id) &&
      JSON.stringify(seen.get(item.id)) !== JSON.stringify(item)
    )
      throw new BrightDataError("BRIGHTDATA_CONFLICTING_DUPLICATE");
    seen.set(item.id, item);
  }
  return [...seen.values()];
}
export function mergeBrightData(snapshot, incoming, { onlyNew = false } = {}) {
  const next = new Map(snapshot.items.map((i) => [i.id, i]));
  let newCount = 0,
    updatedCount = 0;
  for (const item of incoming) {
    const old = next.get(item.id);
    if (
      old &&
      (old.artistId !== item.artistId ||
        old.officialAccountUrl !== item.officialAccountUrl)
    )
      throw new BrightDataError("BRIGHTDATA_CONTENT_IDENTITY_MISMATCH");
    if (!old) {
      next.set(item.id, item);
      newCount++;
      continue;
    }
    // Preserve manual/official provenance, source removal, bookmarks and embed evidence.
    if (onlyNew) continue;
    const merged =
      old.acquisitionMethod === "third-party-api"
        ? {
            ...old,
            publishedAt: item.publishedAt,
            lastValidatedAt: item.lastValidatedAt,
            thirdPartyEvidence: item.thirdPartyEvidence,
          }
        : { ...old, thirdPartyEvidence: item.thirdPartyEvidence };
    if (old.publishedAt !== merged.publishedAt) updatedCount++;
    next.set(item.id, merged);
  }
  return {
    snapshot: { ...snapshot, items: [...next.values()] },
    newCount,
    updatedCount,
  };
}
