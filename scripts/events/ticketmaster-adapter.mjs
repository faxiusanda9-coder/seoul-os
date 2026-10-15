import { safeEventUrl, parseEvent } from "../../src/calendar/engine.ts";

const ROOT = "https://app.ticketmaster.com/discovery/v2";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Never include URL or response body in thrown errors: the URL contains apikey. */
export async function tmGet(
  path,
  params,
  apiKey,
  { fetchImpl = fetch, sleep = wait, timeoutMs = 10000 } = {},
) {
  if (!apiKey) throw new Error("TICKETMASTER_API_KEY missing");
  const url = new URL(`${ROOT}/${path}.json`);
  for (const [key, value] of Object.entries(params))
    if (value != null) url.searchParams.set(key, String(value));
  url.searchParams.set("apikey", apiKey);
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      if (attempt === 2)
        throw new Error("Ticketmaster request timed out or network failed");
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (response.status === 401 || response.status === 403)
      throw new Error(`Ticketmaster authorization failed (${response.status})`);
    if (response.status === 429) {
      if (attempt === 2)
        throw new Error("Ticketmaster rate limit exceeded (429)");
      const retry = Number(response.headers?.get?.("retry-after"));
      await sleep(
        Number.isFinite(retry) && retry > 0
          ? Math.min(retry * 1000, 10000)
          : 1200 * (attempt + 1),
      );
      continue;
    }
    if (response.status >= 500) {
      if (attempt === 2)
        throw new Error(`Ticketmaster server error (${response.status})`);
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (!response.ok)
      throw new Error(`Ticketmaster response (${response.status})`);
    try {
      return await response.json();
    } catch {
      throw new Error("Ticketmaster response is not JSON");
    }
  }
  throw new Error("Ticketmaster request failed");
}

export async function attractionCandidates(name, apiKey, options = {}) {
  const body = await tmGet(
    "attractions",
    { keyword: name, size: 20, page: 0 },
    apiKey,
    options,
  );
  if (!body || !body.page || !Array.isArray(body._embedded?.attractions ?? []))
    throw new Error("Ticketmaster attraction schema invalid");
  return (body._embedded?.attractions ?? [])
    .filter(
      (item) => typeof item.id === "string" && typeof item.name === "string",
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url ?? null,
      classifications: item.classifications ?? [],
    }));
}

export function normalizeTicketmaster(raw, mapping, now) {
  if (
    !raw ||
    typeof raw.id !== "string" ||
    !Array.isArray(raw._embedded?.attractions) ||
    !raw._embedded.attractions.some((item) => item.id === mapping.attractionId)
  )
    return null;
  const start = raw.dates?.start;
  const date =
    start?.dateTBA || start?.dateTBD ? null : (start?.localDate ?? null);
  const precise = !!(
    start?.dateTime &&
    start?.localTime &&
    !start?.timeTBA &&
    !start?.noSpecificTime &&
    date &&
    raw.dates?.timezone
  );
  const status = raw.dates?.status?.code;
  const lifecycle =
    status === "canceled"
      ? "cancelled"
      : status === "postponed"
        ? "postponed"
        : status === "rescheduled"
          ? "rescheduled"
          : "scheduled";
  const venue = raw._embedded?.venues?.[0];
  const music = raw.classifications?.some(
    (item) => item.segment?.name?.toLowerCase() === "music",
  );
  const eventType = /fan[ -]?meet(?:ing)?/i.test(raw.name ?? "")
    ? "fan-meeting"
    : music && /\bconcert\b|\bworld tour\b/i.test(raw.name ?? "")
      ? "concert"
      : "other";
  const event = {
    id: `tm-${raw.id}`,
    artistId: mapping.artistId,
    title: raw.name,
    eventType,
    source: "ticketmaster",
    sourceEventId: raw.id,
    sourceUrl: raw.url,
    verification: "verified",
    lifecycle,
    startAt: precise ? start.dateTime : null,
    endAt: null,
    localDate: date,
    localTime: precise ? start.localTime.slice(0, 5) : null,
    timezone: raw.dates?.timezone ?? null,
    timePrecision: precise ? "datetime" : date ? "date" : "unknown",
    venueName: venue?.name || undefined,
    city: venue?.city?.name || undefined,
    country: venue?.country?.countryCode || undefined,
    ticketStatus: ["onsale", "offsale"].includes(status) ? status : "unknown",
    firstSeenAt: now,
    lastVerifiedAt: now,
    updatedAt: now,
    sequence: 0,
    published: !!date,
  };
  if (!safeEventUrl(event.sourceUrl, "ticketmaster")) return null;
  return parseEvent(event, new Set([mapping.artistId]));
}

/** A stated public onsale time is a separate calendar occurrence from the performance. */
export function normalizeTicketSale(raw, mapping, now) {
  const performance = normalizeTicketmaster(raw, mapping, now);
  const sale = raw?.sales?.public;
  if (
    !performance ||
    sale?.startTBD ||
    !sale?.startDateTime ||
    Number.isNaN(Date.parse(sale.startDateTime)) ||
    Date.parse(sale.startDateTime) <= Date.parse(now) ||
    !["scheduled", "rescheduled"].includes(performance.lifecycle)
  )
    return null;
  const timezone = performance.timezone ?? "UTC";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(sale.startDateTime));
  const part = (name) => parts.find((item) => item.type === name)?.value;
  const event = {
    ...performance,
    id: `tm-sale-${raw.id}`,
    sourceEventId: `${raw.id}:public-onsale`,
    title: `${raw.name} · Public onsale`,
    eventType: "ticket-sale",
    startAt: sale.startDateTime,
    endAt: null,
    localDate: `${part("year")}-${part("month")}-${part("day")}`,
    localTime: `${part("hour")}:${part("minute")}`,
    timezone,
    timePrecision: "datetime",
    venueName: undefined,
    city: undefined,
    country: undefined,
    ticketStatus: "offsale",
  };
  return parseEvent(event, new Set([mapping.artistId]));
}

export async function discoverEvents(
  mapping,
  apiKey,
  {
    now = new Date().toISOString(),
    fetchImpl = fetch,
    sleep = wait,
    maxPages = 10,
  } = {},
) {
  if (
    mapping.mappingStatus !== "verified" ||
    !mapping.attractionId ||
    !mapping.verificationEvidence
  )
    return { events: [], status: "not-matched", requests: 0 };
  const end = new Date(Date.parse(now) + 180 * 86400000).toISOString();
  const events = new Map();
  let requests = 0;
  let totalPages = 1;
  for (
    let page = 0;
    page < totalPages && page < maxPages && page * 50 < 1000;
    page++
  ) {
    if (page) await sleep(550); // FAQ states 2 requests/second.
    const body = await tmGet(
      "events",
      {
        attractionId: mapping.attractionId,
        startDateTime: now.replace(/\.\d{3}Z$/, "Z"),
        endDateTime: end.replace(/\.\d{3}Z$/, "Z"),
        size: 50,
        page,
        sort: "date,asc",
      },
      apiKey,
      { fetchImpl, sleep },
    );
    requests++;
    if (
      !body?.page ||
      !Number.isInteger(body.page.totalPages) ||
      body.page.totalPages < 0
    )
      throw new Error("Ticketmaster pagination schema invalid");
    totalPages = body.page.totalPages;
    for (const raw of body._embedded?.events ?? []) {
      for (const event of [
        normalizeTicketmaster(raw, mapping, now),
        normalizeTicketSale(raw, mapping, now),
      ])
        if (event) events.set(event.id, event);
    }
  }
  return {
    events: [...events.values()],
    status: "ready",
    requests,
    totalPages,
    truncated: totalPages > maxPages || totalPages * 50 > 1000,
  };
}
