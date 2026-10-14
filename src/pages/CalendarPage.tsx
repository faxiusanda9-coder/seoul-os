import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { artists, artistById } from "../data/artists";
import { events, formatEventTime, kstDate } from "../data/events";
import type { CalendarEvent } from "../types";
import {
  demoEventNote,
  demoEventTitle,
  eventTypeLabel,
  useI18n,
} from "../locales/i18n";

const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
const todayInSeoul = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
const monthForDate = (value: string) =>
  new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1);
const demoDate = kstDate(events[0].startsAt);

export function CalendarPage() {
  const { t, locale } = useI18n();
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2023, 0, index + 1))),
  );
  const [month, setMonth] = useState(() => monthForDate(todayInSeoul()));
  const [selected, setSelected] = useState(todayInSeoul);
  const [artist, setArtist] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [showBeijing, setShowBeijing] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const filtered = useMemo(
    () =>
      showDemo
        ? events.filter(
            (event) => artist === "all" || event.artistId === artist,
          )
        : [],
    [artist, showDemo],
  );
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });
  const leading = getDay(startOfMonth(month));
  const selectedEvents = filtered.filter(
    (event) => kstDate(event.startsAt) === selected,
  );
  const monthEvents = filtered.filter((event) =>
    kstDate(event.startsAt).startsWith(format(month, "yyyy-MM")),
  );
  function changeMonth(next: Date) {
    setMonth(next);
    setSelected(dateKey(startOfMonth(next)));
    setSelectedEvent(null);
  }
  function chooseDate(date: string) {
    setSelected(date);
    setSelectedEvent(
      filtered.find((event) => kstDate(event.startsAt) === date) ?? null,
    );
  }
  function toggleDemo(enabled: boolean) {
    setShowDemo(enabled);
    setSelectedEvent(null);
    const nextDate = enabled ? demoDate : todayInSeoul();
    setSelected(nextDate);
    setMonth(monthForDate(nextDate));
  }
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">THE RHYTHM OF WHAT'S NEXT</p>
        <h1>
          Calendar,
          <br />
          <em>in your time.</em>
        </h1>
        <p>{t("calendar.intro")}</p>
      </div>
      <div className="calendar-status">
        <div>
          <strong>{t("calendar.statusTitle")}</strong>
          <p>{t("calendar.statusBody")}</p>
        </div>
        <label className="calendar-demo-switch">
          <input
            type="checkbox"
            checked={showDemo}
            onChange={(event) => toggleDemo(event.target.checked)}
          />
          <span>{t("calendar.showDemo")}</span>
        </label>
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
          {showDemo && (
            <div className="calendar-filter-row">
              <label className="select-field">
                <span>{t("discover.filterArtist")}</span>
                <select
                  value={artist}
                  onChange={(e) => {
                    setArtist(e.target.value);
                    setSelectedEvent(null);
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
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={showBeijing}
                  onChange={(e) => setShowBeijing(e.target.checked)}
                />
                <span>{t("calendar.showBeijing")}</span>
              </label>
            </div>
          )}
          <div className="calendar-grid">
            {weekdays.map((day) => (
              <div className="weekday" key={day}>
                {day}
              </div>
            ))}
            {Array.from({ length: leading }, (_, index) => (
              <div className="calendar-blank" key={`blank-${index}`} />
            ))}
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = filtered.filter(
                (event) => kstDate(event.startsAt) === key,
              );
              return (
                <button
                  type="button"
                  key={key}
                  className={`calendar-day ${selected === key ? "selected" : ""} ${dayEvents.length ? "has-event" : ""}`}
                  onClick={() => chooseDate(key)}
                  aria-label={
                    showDemo
                      ? t("calendar.dayDemoCount", {
                          date: key,
                          count: dayEvents.length,
                        })
                      : t("calendar.dayNoOfficial", { date: key })
                  }
                  aria-pressed={selected === key}
                >
                  <span>{format(day, "d")}</span>
                  <span className="day-dots">
                    {dayEvents.slice(0, 3).map((event) => (
                      <i
                        key={event.id}
                        className={`dot-${event.type.toLowerCase().replace(" ", "-")}`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          {showDemo && (
            <div className="calendar-legend">
              <span>
                <i className="dot-release" />{" "}
                {eventTypeLabel(locale, "Release")}
              </span>
              <span>
                <i className="dot-live" /> {eventTypeLabel(locale, "Live")}
              </span>
              <span>
                <i className="dot-fan-event" />{" "}
                {eventTypeLabel(locale, "Fan Event")}
              </span>
            </div>
          )}
        </section>
        <aside className="event-panel">
          <div className="event-panel-head">
            <p className="eyebrow" lang={locale}>
              {showDemo
                ? t("calendar.demoLabel")
                : t("calendar.noOfficialLabel")}
            </p>
            <h2>
              <time dateTime={selected}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(new Date(`${selected}T12:00:00Z`))}
              </time>
            </h2>
            <p>
              {showDemo
                ? selectedEvents.length
                  ? t("calendar.demoCount", { count: selectedEvents.length })
                  : t("calendar.noDemoDay")
                : t("calendar.noVerifiedDay")}
            </p>
          </div>
          <div className="event-list">
            {selectedEvents.map((event) => (
              <button
                type="button"
                className={`event-row ${selectedEvent?.id === event.id ? "selected" : ""}`}
                key={event.id}
                onClick={() => setSelectedEvent(event)}
              >
                <span
                  className={`event-type dot-${event.type.toLowerCase().replace(" ", "-")}`}
                >
                  {t("calendar.demoPrefix", {
                    type: eventTypeLabel(locale, event.type),
                  })}
                </span>
                <strong>{demoEventTitle(locale, event.id, event.title)}</strong>
                <small>{artistById(event.artistId)?.name}</small>
              </button>
            ))}
            {!selectedEvents.length && (
              <div className="event-empty">
                {showDemo
                  ? t("calendar.selectDotted")
                  : t("calendar.noOfficialInference")}
              </div>
            )}
          </div>
          <div className="upcoming">
            <p className="eyebrow">
              {showDemo ? t("calendar.monthDemo") : t("calendar.monthVerified")}
            </p>
            {monthEvents.length ? (
              monthEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    chooseDate(kstDate(event.startsAt));
                    setSelectedEvent(event);
                  }}
                >
                  <span>{kstDate(event.startsAt).slice(8)}</span>
                  {artistById(event.artistId)?.name}{" "}
                  <small>
                    {t("calendar.demoShort", {
                      type: eventTypeLabel(locale, event.type),
                    })}
                  </small>
                </button>
              ))
            ) : (
              <p className="muted">
                {showDemo
                  ? t("calendar.noDemoMonth")
                  : t("calendar.noOfficialMonth")}
              </p>
            )}
          </div>
        </aside>
      </div>
      {selectedEvent && filtered.includes(selectedEvent) && (
        <section className="event-detail">
          <div>
            <p className="eyebrow">EVENT DETAIL / DEMO</p>
            <h2>
              {demoEventTitle(locale, selectedEvent.id, selectedEvent.title)}
            </h2>
            <p>{demoEventNote(locale, selectedEvent.id, selectedEvent.note)}</p>
          </div>
          <div className="event-detail-meta">
            <span>
              <MapPin size={17} /> {artistById(selectedEvent.artistId)?.name} ·{" "}
              {eventTypeLabel(locale, selectedEvent.type)}
            </span>
            <span>
              <Clock3 size={17} />{" "}
              {formatEventTime(
                selectedEvent.startsAt,
                showBeijing ? "Asia/Shanghai" : "Asia/Seoul",
                locale,
              )}{" "}
              {showBeijing ? "BJT" : "KST"}
            </span>
            <button
              className="text-button"
              type="button"
              onClick={() => setShowBeijing((value) => !value)}
            >
              {showBeijing
                ? t("calendar.switchToKst")
                : t("calendar.switchToBjt")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
