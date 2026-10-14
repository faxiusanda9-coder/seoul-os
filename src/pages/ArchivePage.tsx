import { useState } from "react";
import { Bookmark, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { archiveCategories, feed } from "../data/feed";
import { artistById } from "../data/artists";
import { FeedThumbnail } from "../components/FeedThumbnail";
import { useArchive } from "../store/ArchiveContext";
import type { ArchiveCategory } from "../types";
import { publishedLabel } from "../utils/feed";

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
            const artist = artistById(item.artistId);
            if (!artist) return null;
            return (
              <article className="archive-card" key={item.id}>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`打开 ${item.title} 来源，新窗口`}
                >
                  <FeedThumbnail item={item} />
                </a>
                <div className="archive-card-copy">
                  <p className="eyebrow">
                    {artist.name} / {item.type}
                  </p>
                  <h2>{item.title}</h2>
                  <p>
                    {item.source} · {publishedLabel(item)}
                  </p>
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
                    <a
                      className="icon-button"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`打开 ${item.title} 来源，新窗口`}
                    >
                      <ArrowUpRight size={18} />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state archive-empty">
          <Bookmark size={28} />
          <h2>
            {saved.length
              ? `暂无 ${category} 收藏。`
              : "这一页，还等着你的收藏。"}
          </h2>
          <p>
            {saved.length
              ? "可以切换上方分类，或去动态列表收藏新内容。"
              : "从 Daily JYP Feed 点击书签图标，内容会出现在对应分类。"}
          </p>
          <Link className="primary-button" to="/#daily-feed">
            Explore the feed <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}
