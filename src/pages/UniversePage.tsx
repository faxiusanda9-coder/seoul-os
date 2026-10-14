import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { artistById } from "../data/artists";
import { timeline } from "../data/timeline";
import { timelineDescription, useI18n } from "../locales/i18n";

const years = [...new Set(timeline.map((item) => item.year))];

export function UniversePage() {
  const { t, locale } = useI18n();
  const [year, setYear] = useState(years[0]);
  const entries = timeline.filter((item) => item.year === year);
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">THE JYP UNIVERSE / ARCHIVE OF MOMENTS</p>
        <h1>
          Every beginning
          <br />
          <em>has a sound.</em>
        </h1>
        <p>{t("universe.intro")}</p>
      </div>
      <div className="universe-layout">
        <div className="year-rail" aria-label={t("universe.yearPicker")}>
          {years.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={year === item}
              className={year === item ? "active" : ""}
              onClick={() => setYear(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <section className="timeline-content" aria-live="polite">
          <div className="timeline-year">
            <span>{t("universe.selectedYear")}</span>
            <strong>{year}</strong>
            <span>
              {t("universe.momentCount", {
                count: String(entries.length).padStart(2, "0"),
              })}
            </span>
          </div>
          <div className="timeline-list">
            {entries.map((item) => (
              <article className="timeline-entry" key={item.id}>
                <div className="timeline-date">{item.date}</div>
                <div>
                  <p className="eyebrow">
                    {artistById(item.artistId)?.name} /{" "}
                    {item.status === "verified"
                      ? t("universe.verifiedRelease")
                      : t("common.demo")}
                  </p>
                  <h2>{item.title}</h2>
                  <p>
                    {timelineDescription(
                      locale,
                      item.artistId,
                      item.description,
                    )}
                  </p>
                  {item.status === "verified" ? (
                    <a
                      className="text-link"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("universe.officialSource")} <ArrowUpRight size={16} />
                    </a>
                  ) : (
                    <span className="muted">{t("universe.demoNoSource")}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <p className="timeline-disclaimer">{t("universe.disclaimer")}</p>
    </div>
  );
}
