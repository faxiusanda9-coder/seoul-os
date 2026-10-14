import { ArrowUpRight, Heart, FolderHeart, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { artists } from "../data/artists";
import { useArchive } from "../store/ArchiveContext";
import { ArtistArt } from "../components/ArtistArt";

export function MySpacePage() {
  const { saved, followedArtists, toggleFollow } = useArchive();
  const followed = artists.filter((item) => followedArtists.includes(item.id));
  return (
    <div className="page-wrap page-pad">
      <div className="page-intro">
        <p className="eyebrow">A SPACE THAT FEELS LIKE YOURS</p>
        <h1>
          My Space<span className="period">.</span>
        </h1>
        <p>
          选择你关注的艺人，慢慢建立自己的 K-pop 宇宙。偏好只保存在当前浏览器。
        </p>
      </div>
      <div className="space-summary">
        <div>
          <Heart size={22} />
          <strong>{followed.length}</strong>
          <span>followed artists</span>
        </div>
        <div>
          <FolderHeart size={22} />
          <strong>{saved.length}</strong>
          <span>saved pieces</span>
        </div>
        <Link to="/archive">
          Open archive <ArrowUpRight size={18} />
        </Link>
      </div>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR ORBIT</p>
            <h2>Following</h2>
            <p className="section-note">点击艺人卡片旁的按钮可取消关注。</p>
          </div>
          <Link className="text-link" to="/artists">
            Explore artists <ArrowUpRight size={17} />
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
                  aria-label={`取消关注 ${item.name}`}
                >
                  Following ✓
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Heart size={28} />
            <h3>你的关注列表还空着。</h3>
            <p>
              去艺人目录选择喜欢的组合；无需登录，点击卡片上的 Follow 即可。
            </p>
            <Link className="text-button" to="/artists">
              Browse artists <ArrowUpRight size={17} />
            </Link>
          </div>
        )}
      </section>
      <div className="coming-panel">
        <Bell size={22} />
        <div>
          <strong>Personal notifications</strong>
          <p>关注艺人的实时提醒将在后续版本开放。</p>
        </div>
        <span>COMING SOON</span>
      </div>
    </div>
  );
}
