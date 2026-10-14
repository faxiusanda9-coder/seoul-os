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

const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const todayInSeoul = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
const monthForDate = (value: string) =>
  new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1);
const demoDate = kstDate(events[0].startsAt);

export function CalendarPage() {
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
        <p>
          当前尚未接入已核实的官方日程。开启虚构样例后，可体验筛选和时区切换。
        </p>
      </div>
      <div className="calendar-status">
        <div>
          <strong>官方日程尚未接入</strong>
          <p>这里没有已核实的活动记录；日历空白不代表艺人当天没有活动。</p>
        </div>
        <label className="calendar-demo-switch">
          <input
            type="checkbox"
            checked={showDemo}
            onChange={(event) => toggleDemo(event.target.checked)}
          />
          <span>显示 2099 年虚构演示活动</span>
        </label>
      </div>
      <div className="calendar-layout">
        <section className="calendar-panel" aria-label="活动日历">
          <div className="calendar-toolbar">
            <div>
              <p className="eyebrow">EVENT CALENDAR</p>
              <h2>{format(month, "MMMM yyyy")}</h2>
            </div>
            <div className="month-controls">
              <button
                className="icon-button outlined"
                type="button"
                aria-label="上一个月"
                onClick={() => changeMonth(subMonths(month, 1))}
              >
                <ChevronLeft size={21} />
              </button>
              <button
                className="icon-button outlined"
                type="button"
                aria-label="下一个月"
                onClick={() => changeMonth(addMonths(month, 1))}
              >
                <ChevronRight size={21} />
              </button>
            </div>
          </div>
          {showDemo && (
            <div className="calendar-filter-row">
              <label className="select-field">
                <span>Artist</span>
                <select
                  value={artist}
                  onChange={(e) => {
                    setArtist(e.target.value);
                    setSelectedEvent(null);
                  }}
                >
                  <option value="all">All artists</option>
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
                <span>显示北京时间</span>
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
                  aria-label={`${key}，${showDemo ? `${dayEvents.length} 个虚构演示活动` : "官方日程未接入"}`}
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
                <i className="dot-release" /> Release
              </span>
              <span>
                <i className="dot-live" /> Live
              </span>
              <span>
                <i className="dot-fan-event" /> Fan Event
              </span>
            </div>
          )}
        </section>
        <aside className="event-panel">
          <div className="event-panel-head">
            <p className="eyebrow">
              {showDemo ? "虚构演示 · 非真实日程" : "未接入官方日程"}
            </p>
            <h2>{selected}</h2>
            <p>
              {showDemo
                ? selectedEvents.length
                  ? `${selectedEvents.length} 个虚构演示活动`
                  : "这一天没有演示样例"
                : "尚无已核实的活动记录"}
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
                  虚构演示 · {event.type}
                </span>
                <strong>{event.title}</strong>
                <small>{artistById(event.artistId)?.name}</small>
              </button>
            ))}
            {!selectedEvents.length && (
              <div className="event-empty">
                {showDemo
                  ? "选择带有彩色圆点的日期查看虚构样例。"
                  : "官方日程尚未接入，不能据此判断这一天是否有活动。"}
              </div>
            )}
          </div>
          <div className="upcoming">
            <p className="eyebrow">
              {showDemo ? "本月虚构演示样例" : "本月已核实日程"}
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
                  <small>虚构 · {event.type}</small>
                </button>
              ))
            ) : (
              <p className="muted">
                {showDemo
                  ? "本月没有虚构演示样例。"
                  : "尚未收录官方日程；不代表本月没有活动。"}
              </p>
            )}
          </div>
        </aside>
      </div>
      {selectedEvent && filtered.includes(selectedEvent) && (
        <section className="event-detail">
          <div>
            <p className="eyebrow">EVENT DETAIL / DEMO</p>
            <h2>{selectedEvent.title}</h2>
            <p>{selectedEvent.note}</p>
          </div>
          <div className="event-detail-meta">
            <span>
              <MapPin size={17} /> {artistById(selectedEvent.artistId)?.name} ·{" "}
              {selectedEvent.type}
            </span>
            <span>
              <Clock3 size={17} />{" "}
              {formatEventTime(
                selectedEvent.startsAt,
                showBeijing ? "Asia/Shanghai" : "Asia/Seoul",
              )}{" "}
              {showBeijing ? "BJT" : "KST"}
            </span>
            <button
              className="text-button"
              type="button"
              onClick={() => setShowBeijing((value) => !value)}
            >
              切换至{showBeijing ? "韩国标准时间" : "北京时间"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
