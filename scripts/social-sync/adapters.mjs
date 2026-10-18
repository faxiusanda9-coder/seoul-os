import { socialIdentity, isInstant } from "../../data/schemas/social.schema.ts";
import { apiRequest, DiscoveryError } from "./http.mjs";

export function canonicalMediaUrl(platform, raw) {
  try {
    const u = new URL(raw);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      ![`${platform}.com`, `www.${platform}.com`].includes(u.hostname)
    )
      throw 0;
    u.hostname = `www.${platform}.com`;
    u.search = "";
    u.hash = "";
    if (platform === "instagram") u.pathname = u.pathname.replace(/\/?$/, "/");
    else u.pathname = u.pathname.replace(/\/$/, "");
    if (!socialIdentity(platform, u.href)) throw 0;
    return u.href;
  } catch {
    throw new DiscoveryError("INVALID_CONTENT_URL");
  }
}
function instant(value) {
  if (value === undefined || value === null) return null;
  if (!isInstant(value)) throw new DiscoveryError("INVALID_CONTENT_TIMESTAMP");
  return value;
}
function baseItem(account, media, sourceUrl, now, accountId) {
  const identity = socialIdentity(account.platform, sourceUrl);
  if (
    !media ||
    typeof media.id !== "string" ||
    !/^\d{5,40}$/.test(media.id) ||
    (identity.handle && identity.handle !== account.handle.toLowerCase())
  )
    throw new DiscoveryError("CONTENT_IDENTITY_MISMATCH");
  return {
    id: identity.id,
    artistId: account.artistId,
    platform: account.platform,
    title: null,
    description: null,
    thumbnail: null,
    publishedAt: null,
    sourceUrl,
    embedUrl: identity.embedUrl,
    officialAccountUrl: account.accountUrl,
    verificationStatus: "api-verified",
    acquisitionMethod: "api",
    fetchedAt: now,
    lastValidatedAt: now,
    availabilityStatus: "unknown",
    sourceAvailability: "available",
    embedAvailability: "untested",
    evidenceUrl: sourceUrl,
    evidenceNote:
      "Official API returned this media under the verified account; inline playback was not tested.",
    reviewedBy: "SEOUL.OS official API identity validation",
    apiEvidence: {
      provider:
        account.platform === "instagram"
          ? "instagram-business-discovery"
          : "tiktok-display-api",
      mediaId: media.id,
      accountId,
      checkedAt: now,
    },
  };
}
function text(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 10000)
    throw new DiscoveryError("UNSUPPORTED_CONTENT_METADATA");
  return value;
}
export function instagramItem(account, media, now, accountId) {
  const url = canonicalMediaUrl("instagram", media.permalink);
  const type = media.media_type;
  if (!["VIDEO", "IMAGE", "CAROUSEL_ALBUM"].includes(type))
    throw new DiscoveryError("UNSUPPORTED_MEDIA_TYPE");
  const isReel =
    socialIdentity("instagram", url).kind === "reel" ||
    media.media_product_type === "REELS";
  if (isReel && type !== "VIDEO")
    throw new DiscoveryError("MEDIA_TYPE_MISMATCH");
  const item = baseItem(account, media, url, now, accountId);
  if (["REELS", "FEED"].includes(media.media_product_type))
    item.apiEvidence.mediaProductType = media.media_product_type;
  return {
    ...item,
    contentType: isReel ? "reels" : type === "VIDEO" ? "video-post" : "post",
    description: text(media.caption),
    publishedAt: instant(media.timestamp),
  };
}
export function tiktokItem(account, media, now, accountId) {
  const url = canonicalMediaUrl("tiktok", media.share_url);
  if (
    typeof media.id !== "string" ||
    socialIdentity("tiktok", url).id !== `tt-${media.id}` ||
    (media.create_time != null &&
      (!Number.isSafeInteger(media.create_time) || media.create_time <= 0))
  )
    throw new DiscoveryError("CONTENT_IDENTITY_MISMATCH");
  return {
    ...baseItem(account, media, url, now, accountId),
    contentType: "short-video",
    title: text(media.title),
    description: text(media.video_description),
    publishedAt:
      media.create_time == null
        ? null
        : instant(new Date(media.create_time * 1000).toISOString()),
  };
}

export async function discoverInstagram(account, credentials, options) {
  const { now, maxPages = 20, graphVersion = "v26.0" } = options;
  if (
    !/^v\d{2}\.0$/.test(graphVersion) ||
    !/^\d{5,40}$/.test(credentials.callerId)
  )
    throw new DiscoveryError("INVALID_INSTAGRAM_CONFIGURATION");
  const items = new Map(),
    cursors = new Set();
  let after = "",
    accountId;
  for (let page = 1; page <= maxPages; page++) {
    const edge = `media.limit(25)${after ? `.after(${after})` : ""}{id,caption,media_type,media_product_type,permalink,timestamp}`;
    const u = new URL(
      `https://graph.facebook.com/${graphVersion}/${credentials.callerId}`,
    );
    u.searchParams.set(
      "fields",
      `id,business_discovery.username(${account.handle}){id,username,${edge}}`,
    );
    const body = await apiRequest(
      u.href,
      { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
      options,
    );
    const data = body.business_discovery;
    if (
      body.id !== credentials.callerId ||
      !data ||
      typeof data.id !== "string" ||
      !/^\d{5,40}$/.test(data.id) ||
      data.username?.toLowerCase() !== account.handle.toLowerCase() ||
      (accountId && accountId !== data.id)
    )
      throw new DiscoveryError("ACCOUNT_IDENTITY_MISMATCH");
    accountId = data.id;
    if (!Array.isArray(data.media?.data))
      throw new DiscoveryError("INCOMPLETE_MEDIA_RESPONSE");
    for (const m of data.media.data) {
      const item = instagramItem(account, m, now, accountId);
      if (
        [...items.values()].some(
          (i) => i.apiEvidence.mediaId === m.id && i.id !== item.id,
        )
      )
        throw new DiscoveryError("CONTENT_IDENTITY_MISMATCH");
      if (items.has(item.id) && items.get(item.id).apiEvidence.mediaId !== m.id)
        throw new DiscoveryError("CONTENT_IDENTITY_MISMATCH");
      items.set(item.id, item);
    }
    // Business Discovery uses nested cursors; never follow paging.next URLs
    // (which may carry tokens), and never assume ordering/since support.
    const next = data.media.paging?.cursors?.after;
    if (!next)
      return { items: [...items.values()], pagesRead: page, accountId };
    if (
      typeof next !== "string" ||
      !/^[A-Za-z0-9_=+/-]{1,4096}$/.test(next) ||
      cursors.has(next) ||
      !data.media.data.length
    )
      throw new DiscoveryError("INVALID_OR_REPEATED_CURSOR");
    cursors.add(next);
    after = next;
  }
  throw new DiscoveryError("PAGE_LIMIT_INCOMPLETE");
}

export async function discoverTikTok(account, credentials, options) {
  const {
    now,
    maxPages = 20,
    lastSuccessAt = null,
    overlapHours = 48,
  } = options;
  const headers = {
    Authorization: `Bearer ${credentials.accessToken}`,
    "Content-Type": "application/json",
  };
  const identity = await apiRequest(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,username",
    { headers },
    options,
  );
  const user = identity.data?.user;
  if (
    user?.open_id !== credentials.openId ||
    typeof user.username !== "string" ||
    user.username.toLowerCase() !== account.handle.toLowerCase()
  )
    throw new DiscoveryError("ACCOUNT_IDENTITY_MISMATCH");
  const cutoff = lastSuccessAt
    ? Date.parse(lastSuccessAt) - overlapHours * 3600000
    : -Infinity;
  let cursor;
  const cursors = new Set(),
    items = new Map();
  for (let page = 1; page <= maxPages; page++) {
    const body = await apiRequest(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,share_url",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          max_count: 20,
          ...(cursor !== undefined ? { cursor } : {}),
        }),
      },
      options,
    );
    const data = body.data;
    if (!Array.isArray(data?.videos) || typeof data.has_more !== "boolean")
      throw new DiscoveryError("INCOMPLETE_MEDIA_RESPONSE");
    const pageItems = data.videos.map((m) =>
      tiktokItem(account, m, now, account.handle.toLowerCase()),
    );
    for (const item of pageItems) items.set(item.id, item);
    // TikTok explicitly documents descending create_time. Keep a 48h overlap.
    if (
      !data.has_more ||
      (pageItems.length &&
        pageItems.every((i) => Date.parse(i.publishedAt) < cutoff))
    )
      return {
        items: [...items.values()],
        pagesRead: page,
        accountId: account.handle.toLowerCase(),
      };
    if (
      !Number.isSafeInteger(data.cursor) ||
      data.cursor < 0 ||
      cursors.has(data.cursor) ||
      !pageItems.length
    )
      throw new DiscoveryError("INVALID_OR_REPEATED_CURSOR");
    cursors.add(data.cursor);
    cursor = data.cursor;
  }
  throw new DiscoveryError("PAGE_LIMIT_INCOMPLETE");
}
