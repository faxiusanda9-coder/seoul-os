import { artists } from "../data/artists";
import { ArtistCard } from "../components/ArtistCard";

export function ArtistsPage() {
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">THE DIRECTORY / 001—009</p>
        <h1>
          Artists, in
          <br />
          <em>their own colors.</em>
        </h1>
        <p>
          九个入口，九种不同的音乐气质。官方视频缩略图帮助你认出熟悉的面孔；文字封面延续各自的视觉章节。
        </p>
      </div>
      <div className="directory-head">
        <span>JYP ARTIST FILES</span>
        <span>{String(artists.length).padStart(2, "0")} ARTISTS</span>
      </div>
      <div className="artist-grid directory-grid">
        {artists.map((item, index) => (
          <ArtistCard key={item.id} artist={item} index={index} />
        ))}
      </div>
    </div>
  );
}
