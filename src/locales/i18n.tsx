import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import type { ArchiveCategory, ContentType, EventType } from "../types";
import zh from "./zh-CN.json";
import en from "./en.json";

export type Locale = "zh-CN" | "en";
export type MessageKey = keyof typeof zh;
type Params = Record<string, string | number>;
const english: Record<MessageKey, string> = en;
const messages: Record<Locale, Record<MessageKey, string>> = {
  "zh-CN": zh,
  en: english,
};
const STORAGE_KEY = "seoul-os-locale-v1";

export function translate(
  locale: Locale,
  key: MessageKey,
  params: Params = {},
) {
  return messages[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

const typeKeys: Record<ContentType, MessageKey> = {
  "Music Video": "common.content.musicVideo",
  Performance: "common.content.performance",
  Comeback: "common.content.comeback",
  Teaser: "common.content.teaser",
  Announcement: "common.content.announcement",
  Live: "common.content.live",
  Other: "common.content.other",
};
const categoryKeys: Record<ArchiveCategory, MessageKey> = {
  "Favorite Stages": "common.category.stages",
  "Music Videos": "common.category.videos",
  Albums: "common.category.albums",
  "Watch Later": "common.category.watchLater",
};
const eventKeys: Record<EventType, MessageKey> = {
  Release: "calendar.type.release",
  Live: "calendar.type.live",
  "Fan Event": "calendar.type.fanEvent",
};

export function contentTypeLabel(locale: Locale, type: ContentType) {
  return translate(locale, typeKeys[type]);
}
export function archiveCategoryLabel(
  locale: Locale,
  category: ArchiveCategory,
) {
  return translate(locale, categoryKeys[category]);
}
export function eventTypeLabel(locale: Locale, type: EventType) {
  return translate(locale, eventKeys[type]);
}

const artistDescriptionKeys: Record<string, MessageKey> = {
  twice: "artists.desc.twice",
  "stray-kids": "artists.desc.stray-kids",
  itzy: "artists.desc.itzy",
  nmixx: "artists.desc.nmixx",
  day6: "artists.desc.day6",
  "xdinary-heroes": "artists.desc.xdinary-heroes",
  kickflip: "artists.desc.kickflip",
  niziu: "artists.desc.niziu",
  nexz: "artists.desc.nexz",
};
const timelineDescriptionKeys: Record<string, MessageKey> = {
  twice: "universe.desc.twice",
  "stray-kids": "universe.desc.stray-kids",
  itzy: "universe.desc.itzy",
  nmixx: "universe.desc.nmixx",
};
const demoTitleKeys: Record<string, MessageKey> = {
  e1: "calendar.demoTitle.e1",
  e2: "calendar.demoTitle.e2",
  e3: "calendar.demoTitle.e3",
  e4: "calendar.demoTitle.e4",
  e5: "calendar.demoTitle.e5",
  e6: "calendar.demoTitle.e6",
};
const demoNoteKeys: Record<string, MessageKey> = {
  e1: "calendar.demoNote.e1",
  e2: "calendar.demoNote.e2",
  e3: "calendar.demoNote.e3",
  e4: "calendar.demoNote.e4",
  e5: "calendar.demoNote.e5",
  e6: "calendar.demoNote.e6",
};

export function artistDescription(
  locale: Locale,
  id: string,
  fallback: string,
) {
  const key = artistDescriptionKeys[id];
  return key ? translate(locale, key) : fallback;
}
export function timelineDescription(
  locale: Locale,
  id: string,
  fallback: string,
) {
  const key = timelineDescriptionKeys[id];
  return key ? translate(locale, key) : fallback;
}
export function demoEventTitle(locale: Locale, id: string, fallback: string) {
  const key = demoTitleKeys[id];
  return key ? translate(locale, key) : fallback;
}
export function demoEventNote(locale: Locale, id: string, fallback: string) {
  const key = demoNoteKeys[id];
  return key ? translate(locale, key) : fallback;
}

function readLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

type I18nState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Params) => string;
  storageWarning: boolean;
};
const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [storageWarning, setStorageWarning] = useState(false);
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      setStorageWarning(true);
    }
  }, [locale]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLocale(readLocale());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: (key, params) => translate(locale, key, params),
        storageWarning,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
