import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { artists, artistById } from "../data/artists";
import { officialSources } from "../data/officialSources";
import { useArchive } from "../store/ArchiveContext";
import { useI18n } from "../locales/i18n";
import { eventDate, parseSnapshot, currentlyPublishable } from "./engine";
import { downloadIcs } from "./ics";
import type {
  CalendarEventRecord,
  CalendarSnapshot,
  EventKind,
  EventLifecycle,
} from "./types";

const artistIds = new Set(artists.map((artist) => artist.id));
const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(
    new Date(),
  );
const monthFor = (value: string) =>
  new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1);
const kinds: EventKind[] = [
  "concert",
  "fan-meeting",
  "livestream",
  "release",
  "ticket-sale",
  "other",
];
const kindsZh: Record<EventKind, string> = {
  concert: "演唱会",
  "fan-meeting": "粉丝见面会",
  livestream: "直播",
  release: "音乐发行",
  "ticket-sale": "售票",
  other: "其他",
};
const kindsEn: Record<EventKind, string> = {
  concert: "Concert",
  "fan-meeting": "Fan meeting",
  livestream: "Live",
  release: "Release",
  "ticket-sale": "Ticket sale",
  other: "Other",
};
const statusZh: Record<EventLifecycle, string> = {
  scheduled: "已安排",
  postponed: "延期",
  rescheduled: "已改期",
  cancelled: "已取消",
  completed: "已结束",
  unknown: "状态待核实",
};
const statusEn: Record<EventLifecycle, string> = {
  scheduled: "Scheduled",
  postponed: "Postponed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
  unknown: "Status pending",
};

export function VerifiedCalendar({ onShowDemo }: { onShowDemo: () => void }) {
  const { t, locale } = useI18n();
  const { followedArtists } = useArchive();
  const [snapshot, setSnapshot] = useState<CalendarSnapshot | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [month, setMonth] = useState(() => monthFor(today()));
  const [selected, setSelected] = useState(today);
  const [artist, setArtist] = useState("all");
  const [kind, setKind] = useState("all");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/calendar/events.json`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((body: unknown) => {
        const parsed = parseSnapshot(body, artistIds);
        if (!parsed) throw new Error("Invalid calendar data");
        setSnapshot(parsed);
        setLoadState("ready");
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setLoadState("error");
      });
    return () => controller.abort();
  }, []);
  const published = useMemo(
    () =>
      (snapshot?.events ?? []).filter((event) =>
        currentlyPublishable(event, new Date().toISOString()),
      ),
    [snapshot],
  );
  const availableKinds = kinds.filter((item) =>
    published.some((event) => event.eventType === item),
  );
  const filtered = useMemo(
    () =>
      published.filter(
        (event) =>
          (artist === "all" || event.artistId === artist) &&
          (kind === "all" || event.eventType === kind) &&
          (!followingOnly || followedArtists.includes(event.artistId)),
      ),
    [published, artist, kind, followingOnly, followedArtists],
  );
  const selectedEvents = filtered.filter(
    (event) => eventDate(event) === selected,
  );
  const monthEvents = filtered.filter((event) =>
    eventDate(event)?.startsWith(format(month, "yyyy-MM")),
  );
  const selectedEvent =
    filtered.find((event) => event.id === selectedEventId) ?? null;
  const undated = (snapshot?.events ?? []).filter(
    (event) =>
      event.timePrecision === "unknown" && event.verification === "verified",
  );
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2023, 0, index + 1))),
  );
  function changeMonth(next: Date) {
    setMonth(next);
    setSelected(dateKey(startOfMonth(next)));
    setSelectedEventId(null);
  }
  function chooseDate(value: string) {
    setSelected(value);
    setSelectedEventId(
      filtered.find((event) => eventDate(event) === value)?.id ?? null,
    );
  }
  function timeText(event: CalendarEventRecord) {
    if (!event.startAt) return t("calendarEngine.timeUnknown");
    return (
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Shanghai",
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
      }).format(new Date(event.startAt)) + " BJT"
    );
  }
  function originalTime(event: CalendarEventRecord) {
    if (!event.startAt || !event.timezone)
      return event.localDate ?? t("calendarEngine.timeUnknown");
    return (
      new Intl.DateTimeFormat(locale, {
        timeZone: event.timezone,
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
      }).format(new Date(event.startAt)) + ` (${event.timezone})`
    );
  }
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">YOUR JYP CALENDAR</p>
        <h1>
          Calendar,
          <br />
          <em>in your time.</em>
        </h1>
        <p>{t("calendarEngine.intro")}</p>
      </div>
      <div className="calendar-status">
        <div>
          <strong>
            {loadState === "loading"
              ? t("calendarEngine.loading")
              : loadState === "error"
                ? t("calendarEngine.error")
                : published.length
                  ? t("calendarEngine.count", { count: published.length })
                  : t("calendarEngine.emptyTitle")}
          </strong>
          <p>
            {loadState === "ready"
              ? snapshot?.sourceStatus.ticketmaster === "blocked"
                ? t("calendarEngine.sourceBlocked")
                : snapshot?.sourceStatus.ticketmaster === "failed"
                  ? t("calendarEngine.sourceFailed")
                  : t("calendarEngine.sourceReady")
              : t("calendarEngine.emptyBody")}
          </p>
          {snapshot?.generatedAt && (
            <small>
              {t("calendarEngine.updated", {
                date: new Intl.DateTimeFormat(locale, {
                  timeZone: "Asia/Shanghai",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(snapshot.generatedAt)),
              })}
            </small>
          )}
        </div>
        <button
          className="calendar-demo-switch"
          type="button"
          onClick={onShowDemo}
        >
          {t("calendar.showDemo")}
        </button>
      </div>
      <div className="calendar-layout">
        <section className="calendar-panel" aria-label={t("calendar.label")}>
          <div className="calendar-toolbar">
            <div>
              <p className="eyebrow">EVENT CALENDAR</p>
              <h2>
                {new Intl.DateTimeFormat(locale, {
                  month: "long",
                  year: "numeric",
                }).format(month)}
              </h2>
            </div>
            <div className="month-controls">
              <button
                className="icon-button outlined"
                type="button"
                aria-label={t("calendar.previous")}
                onClick={() => changeMonth(subMonths(month, 1))}
              >
                <ChevronLeft size={21} />
              </button>
              <button
                className="icon-button outlined"
                type="button"
                aria-label={t("calendar.next")}
                onClick={() => changeMonth(addMonths(month, 1))}
              >
                <ChevronRight size={21} />
              </button>
            </div>
          </div>
          <div className="calendar-engine-filters">
            <label className="select-field">
              <span>{t("discover.filterArtist")}</span>
              <select
                value={artist}
                onChange={(event) => {
                  setArtist(event.target.value);
                  setSelectedEventId(null);
                }}
              >
                <option value="all">{t("common.allArtists")}</option>
                {artists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <span>{t("calendarEngine.kind")}</span>
              <select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value);
                  setSelectedEventId(null);
                }}
              >
                <option value="all">{t("calendarEngine.allTypes")}</option>
                {availableKinds.map((item) => (
                  <option key={item} value={item}>
                    {locale === "zh-CN" ? kindsZh[item] : kindsEn[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={followingOnly}
                onChange={(event) => setFollowingOnly(event.target.checked)}
              />
              <span>{t("calendarEngine.followingOnly")}</span>
            </label>
          </div>
          <div className="calendar-grid">
            {weekdays.map((day, index) => (
              <div className="weekday" key={`${day}-${index}`}>
                {day}
              </div>
            ))}
            {Array.from({ length: getDay(startOfMonth(month)) }, (_, index) => (
              <div className="calendar-blank" key={`blank-${index}`} />
            ))}
            {days.map((day) => {
              const key = dateKey(day);
              const records = filtered.filter(
                (event) => eventDate(event) === key,
              );
              return (
                <button
                  type="button"
                  key={key}
                  className={`calendar-day ${selected === key ? "selected" : ""} ${records.length ? "has-event" : ""}`}
                  onClick={() => chooseDate(key)}
                  aria-label={t("calendarEngine.dayCount", {
                    date: key,
                    count: records.length,
                  })}
                  aria-pressed={selected === key}
                >
                  <span>{format(day, "d")}</span>
                  <span className="day-dots">
                    {records.slice(0, 3).map((event) => (
                      <i key={event.id} className={`dot-${event.eventType}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="calendar-export">
            <button
              type="button"
              className="text-button"
              disabled={!filtered.length}
              onClick={() => downloadIcs(filtered, "seoul-os-calendar.ics")}
            >
              <Download size={16} /> {t("calendarEngine.exportFiltered")}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={!followingOnly || !filtered.length}
              onClick={() => downloadIcs(filtered, "seoul-os-following.ics")}
            >
              <Download size={16} /> {t("calendarEngine.exportFollowing")}
            </button>
            <a
              className="text-link"
              href={`${import.meta.env.BASE_URL}data/calendar/all.ics`}
            >
              {t("calendarEngine.publicIcs")}
            </a>
          </div>
        </section>
        <aside className="event-panel">
          <div className="event-panel-head">
            <p className="eyebrow">ON YOUR CALENDAR</p>
            <h2>
              <time dateTime={selected}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(new Date(`${selected}T12:00:00Z`))}
              </time>
            </h2>
            <p>
              {t("calendarEngine.dayCount", {
                date: selected,
                count: selectedEvents.length,
              })}
            </p>
          </div>
          <div className="event-list">
            {selectedEvents.map((event) => (
              <button
                type="button"
                className={`event-row ${selectedEventId === event.id ? "selected" : ""}`}
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
              >
                <span className={`event-type dot-${event.eventType}`}>
                  {locale === "zh-CN"
                    ? kindsZh[event.eventType]
                    : kindsEn[event.eventType]}{" "}
                  ·{" "}
                  {event.source === "manual-official"
                    ? "Official Website"
                    : "Ticketmaster"}
                </span>
                <strong>{event.title}</strong>
                <small>
                  {artistById(event.artistId)?.name} ·{" "}
                  {locale === "zh-CN"
                    ? statusZh[event.lifecycle]
                    : statusEn[event.lifecycle]}
                </small>
              </button>
            ))}
            {!selectedEvents.length && (
              <div className="event-empty">
                {loadState === "error"
                  ? t("calendarEngine.error")
                  : followingOnly && !followedArtists.length
                    ? t("calendarEngine.noFollowing")
                    : t("calendarEngine.noDay")}
              </div>
            )}
          </div>
          <div className="upcoming">
            <p className="eyebrow">THIS MONTH</p>
            {monthEvents.length ? (
              monthEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    const date = eventDate(event)!;
                    chooseDate(date);
                    setSelectedEventId(event.id);
                  }}
                >
                  <span>{eventDate(event)?.slice(8)}</span>
                  {artistById(event.artistId)?.name}{" "}
                  <small>
                    {locale === "zh-CN"
                      ? kindsZh[event.eventType]
                      : kindsEn[event.eventType]}
                  </small>
                </button>
              ))
            ) : (
              <p className="muted">{t("calendarEngine.noMonth")}</p>
            )}
          </div>
        </aside>
      </div>
      {selectedEvent && (
        <section className="event-detail">
          <div>
            <p className="eyebrow">
              EVENT DETAIL ·{" "}
              {selectedEvent.source === "ticketmaster"
                ? "TICKETMASTER"
                : "OFFICIAL WEBSITE"}
            </p>
            <h2>{selectedEvent.title}</h2>
            <p>
              {artistById(selectedEvent.artistId)?.name} ·{" "}
              {locale === "zh-CN"
                ? kindsZh[selectedEvent.eventType]
                : kindsEn[selectedEvent.eventType]}{" "}
              ·{" "}
              {locale === "zh-CN"
                ? statusZh[selectedEvent.lifecycle]
                : statusEn[selectedEvent.lifecycle]}
            </p>
            <p>
              {t("calendarEngine.beijingTime")}: {timeText(selectedEvent)}
            </p>
            <p>
              {t("calendarEngine.sourceTime")}: {originalTime(selectedEvent)}
            </p>
            {selectedEvent.ticketStatus &&
              selectedEvent.ticketStatus !== "unknown" && (
                <p>
                  {t("calendarEngine.ticketStatus")}:{" "}
                  {t(
                    selectedEvent.ticketStatus === "onsale"
                      ? "calendarEngine.ticketOnsale"
                      : "calendarEngine.ticketOffsale",
                  )}
                </p>
              )}
            {(selectedEvent.city || selectedEvent.venueName) && (
              <p>
                {[selectedEvent.city, selectedEvent.venueName]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="event-detail-meta">
            <a
              className="text-link"
              href={selectedEvent.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} />
              {t("calendarEngine.openSource")}
            </a>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                downloadIcs([selectedEvent], `seoul-os-${selectedEvent.id}.ics`)
              }
            >
              <Download size={16} />
              {t("calendarEngine.exportOne")}
            </button>
          </div>
        </section>
      )}
      {followingOnly && followedArtists.length === 0 && (
        <p className="calendar-follow-hint">
          <Link className="text-link" to="/artists">
            {t("calendarEngine.browseArtists")} ↗
          </Link>
        </p>
      )}
      {undated.length > 0 && (
        <section className="content-section">
          <h2>{t("calendarEngine.undated")}</h2>
          <p>{t("calendarEngine.undatedNote")}</p>
        </section>
      )}
      <section className="content-section official-calendar-links">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OFFICIAL SCHEDULES</p>
            <h2>{t("official.scheduleTitle")}</h2>
            <p className="section-note">{t("official.calendarNote")}</p>
          </div>
        </div>
        <div className="official-schedule-grid">
          {officialSources
            .filter((source) => source.scheduleUrl)
            .map((source) => (
              <a
                className="official-schedule-link"
                key={source.artistId}
                href={source.scheduleUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>{artistById(source.artistId)?.name}</strong>
                <span>{t("official.openSchedule")} ↗</span>
              </a>
            ))}
        </div>
      </section>
    </div>
  );
}
