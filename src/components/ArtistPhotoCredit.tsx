import { artistVisuals } from "../data/artistVisuals";
import { useI18n } from "../locales/i18n";

export function ArtistPhotoCredit({ artistId, reserveSpace = false }: { artistId: string; reserveSpace?: boolean }) {
  const { t } = useI18n();
  const visual = artistVisuals[artistId];
  if (visual?.imageLicenseStatus !== "licensed" || !visual.imageSource ||
      !visual.imageCredit || !visual.imageLicenseName || !visual.imageLicenseUrl)
    return reserveSpace ? <span className="artist-photo-credit" aria-hidden="true" /> : null;
  return (
    <span className="artist-photo-credit">
      {t("common.photoCredit")} <a href={visual.imageSource} target="_blank" rel="noopener noreferrer">{visual.imageCredit}</a>
      {" · "}<a href={visual.imageLicenseUrl} target="_blank" rel="noopener noreferrer">{visual.imageLicenseName}</a>
      {" · "}{t("common.photoResized")}
    </span>
  );
}
