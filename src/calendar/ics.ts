import type { CalendarEventRecord } from "./types";
import { publishable } from "./engine.ts";

const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
const utc = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const day = (value: string) => value.replace(/-/g, "");
const addDay = (value: string) =>
  new Date(Date.parse(`${value}T12:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
function fold(line: string): string {
  const encoded = new TextEncoder().encode(line);
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let start = 0;
  while (start < encoded.length) {
    let end = Math.min(start + (parts.length ? 74 : 75), encoded.length);
    while (end < encoded.length && (encoded[end] & 0xc0) === 0x80) end--;
    parts.push(
      (parts.length ? " " : "") + decoder.decode(encoded.slice(start, end)),
    );
    start = end;
  }
  return parts.join("\r\n");
}
export function calendarIcs(
  events: CalendarEventRecord[],
  stampedAt: string,
  name = "SEOUL.OS Calendar",
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SEOUL.OS//JYP Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(name)}`,
  ];
  for (const event of events.filter(publishable)) {
    const date = event.localDate!;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@seoul-os`,
      `SEQUENCE:${event.sequence}`,
      `DTSTAMP:${utc(stampedAt)}`,
    );
    if (event.timePrecision === "datetime" && event.startAt) {
      lines.push(`DTSTART:${utc(event.startAt)}`);
      if (event.endAt) lines.push(`DTEND:${utc(event.endAt)}`);
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${day(date)}`,
        `DTEND;VALUE=DATE:${day(addDay(date))}`,
      );
    }
    lines.push(
      `SUMMARY:${escape(event.title)}`,
      `DESCRIPTION:${escape(`${event.artistId} · ${event.source} · ${event.lifecycle}`)}`,
      `URL:${event.sourceUrl}`,
    );
    if (event.lifecycle === "cancelled") lines.push("STATUS:CANCELLED");
    else if (
      event.lifecycle === "scheduled" ||
      event.lifecycle === "rescheduled"
    )
      lines.push("STATUS:CONFIRMED");
    else lines.push("STATUS:TENTATIVE");
    if (event.venueName || event.city)
      lines.push(
        `LOCATION:${escape([event.venueName, event.city, event.country].filter(Boolean).join(", "))}`,
      );
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
export function downloadIcs(events: CalendarEventRecord[], filename: string) {
  const content = calendarIcs(events, new Date().toISOString());
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
