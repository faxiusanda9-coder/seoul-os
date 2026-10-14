import {
  ArrowUpRight,
  Heart,
  FolderHeart,
  Bell,
  Languages,
} from "lucide-react";
import { Link } from "react-router-dom";
import { artists } from "../data/artists";
import { useArchive } from "../store/ArchiveContext";
import { ArtistArt } from "../components/ArtistArt";
import { useI18n } from "../locales/i18n";

export function MySpacePage() {
  const { saved, followedArtists, toggleFollow } = useArchive();
  const { t, locale, setLocale, storageWarning } = useI18n();
  const followed = artists.filter((item) => followedArtists.includes(item.id));
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">A SPACE THAT FEELS LIKE YOURS</p>
        <h1>
          My Space<span className="period">.</span>
        </h1>
        <p>{t("space.intro")}</p>
      </div>
      <div className="space-summary">
        <div>
          <Heart size={22} />
          <strong>{followed.length}</strong>
          <span>{t("space.followCount")}</span>
        </div>
        <div>
          <FolderHeart size={22} />
          <strong>{saved.length}</strong>
          <span>{t("space.savedCount")}</span>
        </div>
        <Link to="/archive">
          {t("space.openArchive")} <ArrowUpRight size={18} />
        </Link>
      </div>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR ORBIT</p>
            <h2>{t("space.following")}</h2>
            <p className="section-note">{t("space.followNote")}</p>
          </div>
          <Link className="text-link" to="/artists">
            {t("space.exploreArtists")} <ArrowUpRight size={17} />
          </Link>
        </div>
        {followed.length ? (
          <div className="follow-list">
            {followed.map((item) => (
              <div className="follow-row" key={item.id}>
                <Link to={`/artists/${item.id}`}>
                  <ArtistArt artist={item} variant="mini" />
                  <span>
                    {item.name}
                    <small>{item.subtitle}</small>
                  </span>
                </Link>
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => toggleFollow(item.id)}
                  aria-label={t("artists.unfollowLabel", { artist: item.name })}
                >
                  {t("artists.following")} ✓
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Heart size={28} />
            <h3>{t("space.emptyTitle")}</h3>
            <p>{t("space.emptyBody")}</p>
            <Link className="text-button" to="/artists">
              {t("common.browseArtists")} <ArrowUpRight size={17} />
            </Link>
          </div>
        )}
      </section>
      <div className="coming-panel">
        <Bell size={22} />
        <div>
          <strong>{t("space.notifications")}</strong>
          <p>{t("space.notificationsNote")}</p>
        </div>
        <span>{t("common.comingSoon")}</span>
      </div>
      <section
        className="language-settings"
        id="settings"
        aria-labelledby="language-title"
      >
        <Languages size={22} aria-hidden="true" />
        <div>
          <p className="eyebrow">SETTINGS / LANGUAGE</p>
          <h2 id="language-title">{t("space.settings")}</h2>
          <p>{t("space.languageNote")}</p>
          <fieldset className="language-options">
            <legend>{t("space.language")}</legend>
            <label className={locale === "zh-CN" ? "active" : ""}>
              <input
                type="radio"
                name="interface-language"
                value="zh-CN"
                checked={locale === "zh-CN"}
                onChange={() => setLocale("zh-CN")}
              />
              {t("space.languageZh")}
            </label>
            <label className={locale === "en" ? "active" : ""}>
              <input
                type="radio"
                name="interface-language"
                value="en"
                checked={locale === "en"}
                onChange={() => setLocale("en")}
              />
              {t("space.languageEn")}
            </label>
          </fieldset>
          <p className="language-saved" role="status">
            {storageWarning
              ? t("space.languageUnavailable")
              : t("space.languageSaved")}
          </p>
        </div>
      </section>
    </div>
  );
}
