import { artists } from "../data/artists";
import { ArtistCard } from "../components/ArtistCard";
import { useI18n } from "../locales/i18n";

export function ArtistsPage() {
  const { t } = useI18n();
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">THE DIRECTORY / 001—{String(artists.length).padStart(3, "0")}</p>
        <h1>
          Artists, in
          <br />
          <em>their own colors.</em>
        </h1>
        <p>{t("artists.intro")}</p>
      </div>
      <div className="directory-head">
        <span>JYP ARTIST FILES</span>
        <span>
          {t("artists.count", {
            count: String(artists.length).padStart(2, "0"),
          })}
        </span>
      </div>
      <div className="artist-grid directory-grid">
        {artists.map((item, index) => (
          <ArtistCard key={item.id} artist={item} index={index} />
        ))}
      </div>
    </div>
  );
}
