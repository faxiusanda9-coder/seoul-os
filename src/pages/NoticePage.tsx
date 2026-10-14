import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { artists, artistById } from "../data/artists";
import { officialSources } from "../data/officialSources";
import { useI18n } from "../locales/i18n";

export function NoticePage() {
  const { t } = useI18n();
  const [artistId, setArtistId] = useState("all");
  const [search, setSearch] = useState("");
  const sources = useMemo(() => officialSources.filter((source) => {
    const name = source.artistId === "jyp-company" ? "JYP Entertainment" :
      artistById(source.artistId)?.name ?? source.artistId;
    return (artistId === "all" || source.artistId === artistId) &&
      name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [artistId, search]);

  return <div className="page-wrap page-pad">
    <div className="page-intro">
      <p className="eyebrow">OFFICIAL INTELLIGENCE / 01</p>
      <h1>Official <em>Updates.</em></h1>
      <p>{t("official.intro")}</p>
    </div>
    <div className="official-status" role="status">
      <strong>{t("official.statusTitle")}</strong>
      <p>{t("official.statusBody")}</p>
    </div>
    <div className="official-toolbar">
      <label className="select-field"><span>{t("official.artistFilter")}</span>
        <select value={artistId} onChange={(event) => setArtistId(event.target.value)}>
          <option value="all">{t("common.allArtists")}</option>
          <option value="jyp-company">JYP Entertainment</option>
          {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
        </select>
      </label>
      <label className="official-search"><Search size={18} aria-hidden="true" />
        <span className="sr-only">{t("official.searchLabel")}</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("official.searchPlaceholder")} />
      </label>
    </div>
    <p className="tiny-note" aria-live="polite">{t("official.sourceCount", { count: sources.length })}</p>
    <div className="official-source-list">
      {sources.length ? sources.map((source) => {
        const name = source.artistId === "jyp-company" ? "JYP Entertainment" :
          artistById(source.artistId)?.name ?? source.artistId;
        return <article className="official-source-card" key={source.artistId}>
          <div><p className="eyebrow">JYP OFFICIAL SOURCE</p><h2>{name}</h2>
            <p>{t("official.linkOnly")}</p>
            <p className="tiny-note"><time dateTime={source.lastCheckedAt}>{t("official.checked", { date: source.lastCheckedAt })}</time></p></div>
          <div className="official-source-actions">
            {source.noticeUrl && <a className="outline-button" href={source.noticeUrl} target="_blank" rel="noopener noreferrer">
              {t("official.openNotice")} <ArrowUpRight size={17} />
            </a>}
            {source.scheduleUrl && <a className="text-link" href={source.scheduleUrl} target="_blank" rel="noopener noreferrer">
              {t("official.openSchedule")} <CalendarDays size={17} />
            </a>}
          </div>
        </article>;
      }) : <div className="empty-state"><h2>{t("official.noSourceTitle")}</h2>
        <p>{t("official.noSourceBody")}</p>
        <button className="text-button" type="button" onClick={() => { setArtistId("all"); setSearch(""); }}>
          {t("common.clearFilters")}
        </button>
        <Link className="text-link" to="/artists">{t("common.browseArtists")}</Link>
      </div>}
    </div>
    <p className="tiny-note official-disclosure">{t("official.noRepublish")}</p>
  </div>;
}
