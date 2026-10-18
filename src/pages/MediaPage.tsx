import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useContent } from "../store/ContentContext";
import { useSocial } from "../store/SocialContext";
import { verifiedMediaAccounts } from "../data/social";
import { sourceForArtist } from "../data/officialSources";
import { socialForArtist } from "../data/officialSocialAccounts";
import { SocialCard } from "../components/SocialCard";
import { FeedCard } from "../components/FeedCard";
import { SourceFreshness } from "../components/SourceFreshness";
import { SocialDiscoveryStatus } from "../components/SocialDiscoveryStatus";
import { OfficialXTimeline } from "../components/OfficialXTimeline";
import { TikTokProfile } from "../components/TikTokProfile";
import { selectSocialContent, type SocialKind } from "../utils/social-library";
import { useI18n, type MessageKey } from "../locales/i18n";
type Tab =
  "youtube" | "instagram" | "tiktok" | "notices" | "events" | "music" | "x";
const tabs: { id: Tab; label: MessageKey }[] = [
  { id: "youtube", label: "media.youtube" },
  { id: "instagram", label: "media.instagram" },
  { id: "tiktok", label: "media.tiktok" },
  { id: "notices", label: "media.notices" },
  { id: "events", label: "media.events" },
  { id: "music", label: "media.music" },
  { id: "x", label: "media.x" },
];
export function MediaPage() {
  const { t } = useI18n();
  const { channels, selectedArtistId, selectArtist, getChannel, loadChannel } =
    useContent();
  const { views, load, closePlayer } = useSocial();
  const [params, setParams] = useSearchParams();
  const artistId = channels.some((c) => c.artistId === params.get("artist"))
    ? params.get("artist")!
    : selectedArtistId;
  const tab = tabs.some((t) => t.id === params.get("platform"))
    ? (params.get("platform") as Tab)
    : "youtube";
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<SocialKind>("all");
  useEffect(() => {
    setSearch("");
    setKind("all");
  }, [artistId, tab]);
  useEffect(() => {
    if (tab === "youtube") loadChannel(artistId);
    else if (tab === "instagram" || tab === "tiktok") load(tab);
  }, [artistId, tab, load, loadChannel]);
  const channel = getChannel(artistId),
    source = sourceForArtist(artistId),
    x = socialForArtist(artistId);
  const socialPlatform = tab === "instagram" || tab === "tiktok" ? tab : null;
  const account = verifiedMediaAccounts.find(
    (a) => a.artistId === artistId && a.platform === tab,
  );
  const items = socialPlatform
    ? selectSocialContent(views[socialPlatform].items, {
        artistId,
        platform: socialPlatform,
        search,
        kind,
      })
    : [];
  const choose = (artist: string, platform: Tab) => {
    setParams({ artist, platform });
    setSearch("");
  };
  return (
    <div className="page-wrap page-pad media-page">
      <div className="page-intro">
        <p className="eyebrow">OFFICIAL MEDIA / YOUR ORBIT</p>
        <h1>
          Media room<span className="period">.</span>
        </h1>
        <p>{t("media.intro")}</p>
      </div>
      <label className="select-field archive-channel-select">
        <span>{t("media.artist")}</span>
        <select
          value={artistId}
          onChange={(e) => {
            selectArtist(e.target.value);
            choose(e.target.value, tab);
          }}
        >
          {channels.map((c) => (
            <option key={c.artistId} value={c.artistId}>
              {c.displayName}
            </option>
          ))}
        </select>
      </label>
      <div
        className="media-tabs"
        role="group"
        aria-label={t("media.platforms")}
      >
        {tabs.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === tab}
            className={p.id === tab ? "active" : ""}
            onClick={() => choose(artistId, p.id)}
          >
            {t(p.label)}
          </button>
        ))}
      </div>
      <section
        className="media-panel"
        aria-label={t(tabs.find((p) => p.id === tab)!.label)}
      >
        {tab === "youtube" && (
          <>
            <SourceFreshness
              artistId={artistId}
              platform="youtube"
              snapshotAt={channel.syncedAt}
            />
            <p className="tiny-note">{t("media.youtubeNote")}</p>
            <Link className="text-link" to="/">
              {t("media.backDiscover")}
            </Link>
            {channel.status === "loading" ? (
              <p role="status">{t("media.loading")}</p>
            ) : channel.status === "fallback" ? (
              <p role="status">{t("media.youtubeFallback")}</p>
            ) : null}
            <div className="feed-list">
              {channel.feed.map((i) => (
                <FeedCard key={i.id} item={i} />
              ))}
            </div>
          </>
        )}
        {socialPlatform && (
          <>
            <div className="media-source-intro">
              <div>
                <p className="eyebrow">{t("discovery.library")}</p>
                <h2>
                  {t(tab === "instagram" ? "media.instagram" : "media.tiktok")}
                </h2>
                <p>{t("discovery.libraryMeaning")}</p>
              </div>
              {account && (
                <a
                  className="outline-button"
                  href={account.accountUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("media.account")} <ArrowUpRight size={16} />
                </a>
              )}
            </div>
            <SocialDiscoveryStatus
              artistId={artistId}
              platform={socialPlatform}
            />
            <SourceFreshness artistId={artistId} platform={socialPlatform} />
            {account ? (
              <p className="tiny-note">
                {t("media.verifiedAccount")} ·{" "}
                <a
                  href={account.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("media.evidenceLink")}
                </a>
              </p>
            ) : (
              <p className="tiny-note">{t("media.accountPending")}</p>
            )}
            <div className="social-library-filters">
              <label className="select-field media-search">
                <span>{t("media.search")}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("media.searchPlaceholder")}
                />
              </label>
              {tab === "instagram" && (
                <label className="select-field media-type-filter">
                  <span>{t("media.contentKind")}</span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as SocialKind)}
                  >
                    <option value="videos">{t("media.videosOnly")}</option>
                    <option value="reels">Instagram Reels</option>
                    <option value="video-post">{t("media.videoPosts")}</option>
                    <option value="post">{t("media.otherPosts")}</option>
                    <option value="all">{t("media.allContent")}</option>
                  </select>
                </label>
              )}
            </div>
            {views[socialPlatform].status === "error" ? (
              <div className="empty-state">
                <h3>{t("media.loadFailed")}</h3>
                <button
                  className="outline-button"
                  type="button"
                  onClick={() => load(socialPlatform)}
                >
                  {t("media.retry")}
                </button>
              </div>
            ) : views[socialPlatform].status === "loading" ||
              views[socialPlatform].status === "idle" ? (
              <p role="status">{t("media.loading")}</p>
            ) : items.length ? (
              <>
                <p className="tiny-note">
                  {t("media.curatedCount", { count: items.length })}
                </p>
                <div className="social-grid">
                  {items.map((i) => (
                    <SocialCard key={`${artistId}:${tab}:${i.id}`} item={i} />
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h3>{t(search ? "media.noMatches" : "media.noItems")}</h3>
                <p>{t(search ? "media.clearSearch" : "media.noItemsBody")}</p>
              </div>
            )}
            {tab === "tiktok" && account && (
              <details
                className="optional-profile"
                onToggle={(e) => {
                  if (!e.currentTarget.open)
                    closePlayer(`profile:tiktok:${account.handle}`);
                }}
              >
                <summary>{t("media.optionalProfile")}</summary>
                <TikTokProfile key={account.accountUrl} account={account} />
              </details>
            )}
          </>
        )}
        {tab === "notices" && (
          <div className="media-link-panel">
            <h2>{t("media.notices")}</h2>
            <p>{t("official.linkOnly")}</p>
            {source?.noticeUrl ? (
              <a
                className="outline-button"
                href={source.noticeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("official.openNotice")} <ArrowUpRight size={16} />
              </a>
            ) : (
              <p>{t("media.accountPending")}</p>
            )}
            <Link className="text-link" to="/official">
              {t("media.allSources")}
            </Link>
          </div>
        )}
        {tab === "events" && (
          <div className="media-link-panel">
            <h2>{t("media.events")}</h2>
            <p>{t("media.eventsNote")}</p>
            {source?.scheduleUrl && (
              <a
                className="outline-button"
                href={source.scheduleUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("official.openSchedule")} <ArrowUpRight size={16} />
              </a>
            )}
            <Link className="outline-button" to="/calendar">
              {t("media.calendar")}
            </Link>
          </div>
        )}
        {tab === "music" && (
          <div className="media-link-panel">
            <h2>{t("media.music")}</h2>
            <p>{t("media.musicNote")}</p>
            {source?.releaseUrl ? (
              <a
                className="outline-button"
                href={source.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("media.openMusic")} <ArrowUpRight size={16} />
              </a>
            ) : (
              <p>{t("media.accountPending")}</p>
            )}
          </div>
        )}
        {tab === "x" &&
          (x ? (
            <OfficialXTimeline key={x.accountHandle} account={x} />
          ) : (
            <div className="empty-state">
              <p>{t("media.accountPending")}</p>
            </div>
          ))}
      </section>
    </div>
  );
}
