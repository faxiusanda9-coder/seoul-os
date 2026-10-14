import { useState } from "react";
import { Bookmark, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { archiveCategories, feed } from "../data/feed";
import { artistById } from "../data/artists";
import { ArtistArt } from "../components/ArtistArt";
import { useArchive } from "../store/ArchiveContext";
import type { ArchiveCategory } from "../types";

export function ArchivePage() {
  const { saved, toggleSaved, moveSaved } = useArchive();
  const [category, setCategory] = useState<ArchiveCategory>(
    () => saved[0]?.category ?? "Favorite Stages",
  );
  const visible = saved
    .filter((item) => item.category === category)
    .map((item) => feed.find((row) => row.id === item.id))
    .filter((item) => item !== undefined);
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">YOUR PRIVATE COLLECTION</p>
        <h1>
          My Archive<span className="period">.</span>
        </h1>
        <p>
          把值得重看的舞台、音乐影像和稍后观看内容放在一个地方。收藏只保存在当前浏览器。
        </p>
      </div>
      <div className="archive-overview">
        <span>{String(saved.length).padStart(2, "0")}</span>
        <p>pieces in your personal archive</p>
        <Bookmark size={27} strokeWidth={1.4} />
      </div>
      <div className="archive-tabs" aria-label="收藏分类">
        {archiveCategories.map((item) => (
          <button
            type="button"
            aria-pressed={category === item}
            className={category === item ? "active" : ""}
            key={item}
            onClick={() => setCategory(item)}
          >
            {item}
            <span>
              {saved.filter((entry) => entry.category === item).length}
            </span>
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="archive-grid">
          {visible.map((item) => {
            const artist = artistById(item.artistId)!;
            return (
              <article className="archive-card" key={item.id}>
                <ArtistArt artist={artist} />
                <div className="archive-card-copy">
                  <p className="eyebrow">
                    {artist.name} / {item.type}
                  </p>
                  <h2>{item.title}</h2>
                  <p>演示内容 · 无真实发布时间</p>
                  <div className="archive-card-actions">
                    <label className="select-field small-select">
                      <span>归档至</span>
                      <select
                        value={category}
                        onChange={(e) => {
                          const next = e.target.value as ArchiveCategory;
                          moveSaved(item.id, next);
                          setCategory(next);
                        }}
                        aria-label={`移动 ${item.title} 到分类`}
                      >
                        {archiveCategories.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`取消收藏 ${item.title}`}
                      onClick={() => toggleSaved(item.id, category)}
                    >
                      <Bookmark size={18} fill="currentColor" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state archive-empty">
          <Bookmark size={28} />
          <h2>这一页，还等着你的收藏。</h2>
          <p>从 Daily JYP Feed 点击书签图标，内容会出现在对应分类。</p>
          <Link className="primary-button" to="/">
            Explore the feed <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}
