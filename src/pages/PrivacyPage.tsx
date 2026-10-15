import { Link } from "react-router-dom";
import { useI18n } from "../locales/i18n";

export function PrivacyPage() {
  const { t } = useI18n();
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">PRIVACY & SOURCES</p>
        <h1>
          Our sources,
          <br />
          <em>clearly stated.</em>
        </h1>
        <p>{t("privacy.intro")}</p>
      </div>
      <section className="content-section">
        <h2>{t("privacy.localTitle")}</h2>
        <p>{t("privacy.localBody")}</p>
        <h2>{t("privacy.externalTitle")}</h2>
        <p>{t("privacy.externalBody")}</p>
        <p>
          <a
            className="text-link"
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Privacy Policy ↗
          </a>{" "}
          ·{" "}
          <a
            className="text-link"
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube Terms ↗
          </a>{" "}
          ·{" "}
          <a
            className="text-link"
            href="https://privacy.ticketmaster.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ticketmaster Privacy ↗
          </a>
        </p>
        <h2>{t("privacy.calendarTitle")}</h2>
        <p>{t("privacy.calendarBody")}</p>
        <p>{t("privacy.thirdParty")}</p>
        <Link className="text-link" to="/calendar">
          {t("privacy.back")}
        </Link>
      </section>
    </div>
  );
}
