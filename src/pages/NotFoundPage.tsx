import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "../locales/i18n";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="page-wrap page-pad not-found">
      <p className="eyebrow">404 / OFF THE RECORD</p>
      <h1>We lost this track.</h1>
      <p>{t("notFound.body")}</p>
      <Link className="primary-button" to="/">
        <ArrowLeft size={17} /> {t("notFound.back")}
      </Link>
    </div>
  );
}
