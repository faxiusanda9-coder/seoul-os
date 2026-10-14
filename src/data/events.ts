import type { CalendarEvent } from "../types";

// Fictional calendar fixtures in a deliberately distant year. They are never
// shown by default and must not be presented as real artist schedules.
export const events: CalendarEvent[] = [
  {
    id: "e1",
    artistId: "twice",
    title: "演示 · 音乐影像上线",
    type: "Release",
    startsAt: "2099-05-14T18:00:00+09:00",
    timeZone: "Asia/Seoul",
    note: "用于演示日期选择和时区展示；不是实际发行公告。",
  },
  {
    id: "e2",
    artistId: "stray-kids",
    title: "演示 · 线上直播",
    type: "Live",
    startsAt: "2099-05-18T20:00:00+09:00",
    timeZone: "Asia/Seoul",
    note: "用于演示活动详情；不是实际直播安排。",
  },
  {
    id: "e3",
    artistId: "day6",
    title: "演示 · 粉丝活动",
    type: "Fan Event",
    startsAt: "2099-05-23T19:30:00+09:00",
    timeZone: "Asia/Seoul",
    note: "用于演示活动类型；不是实际粉丝活动。",
  },
  {
    id: "e4",
    artistId: "nmixx",
    title: "演示 · 作品收录日",
    type: "Release",
    startsAt: "2099-06-06T18:00:00+09:00",
    timeZone: "Asia/Seoul",
    note: "用于演示跨月浏览；不是实际发行公告。",
  },
  {
    id: "e5",
    artistId: "itzy",
    title: "演示 · 舞台直播",
    type: "Live",
    startsAt: "2099-06-15T19:00:00+09:00",
    timeZone: "Asia/Seoul",
    note: "用于演示跨月浏览；不是实际直播安排。",
  },
  {
    id: "e6",
    artistId: "nexz",
    title: "演示 · 见面活动",
    type: "Fan Event",
    startsAt: "2099-04-26T17:00:00+09:00",
    timeZone: "Asia/Seoul",
    note: "用于演示跨月浏览；不是实际活动安排。",
  },
];

export function kstDate(startsAt: string) {
  return startsAt.slice(0, 10);
}
export function formatEventTime(
  startsAt: string,
  timeZone: "Asia/Seoul" | "Asia/Shanghai",
) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(startsAt));
}
