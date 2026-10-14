import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { artistById } from "../data/artists";
import { timeline } from "../data/timeline";

const years = [...new Set(timeline.map((item) => item.year))];

export function UniversePage() {
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
        <p>
          通过年份回看经 JYP
          官方页面确认的发行节点。时间轴将随来源整理逐步扩充。
        </p>
      </div>
      <div className="universe-layout">
        <div className="year-rail" aria-label="选择年份">
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
            <span>SELECTED YEAR</span>
            <strong>{year}</strong>
            <span>
              {String(entries.length).padStart(2, "0")} CURATED MOMENT
              {entries.length > 1 ? "S" : ""}
            </span>
          </div>
          <div className="timeline-list">
            {entries.map((item) => (
              <article className="timeline-entry" key={item.id}>
                <div className="timeline-date">{item.date}</div>
                <div>
                  <p className="eyebrow">
                    {artistById(item.artistId)?.name} /{" "}
                    {item.status === "verified" ? "VERIFIED RELEASE" : "DEMO"}
                  </p>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  {item.status === "verified" ? (
                    <a
                      className="text-link"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      JYP 官方来源 <ArrowUpRight size={16} />
                    </a>
                  ) : (
                    <span className="muted">演示占位，无事实来源</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <p className="timeline-disclaimer">
        历史节点只记录官方来源可核实的发行事实；当前未列出的年份不代表该年没有活动。
      </p>
    </div>
  );
}
