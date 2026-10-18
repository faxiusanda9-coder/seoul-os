import { useEffect, useRef, useState } from "react";
import { Bookmark, ArrowUpRight } from "lucide-react";
import {
  socialAvailability,
  type SocialContent,
} from "../../data/schemas/social.schema";
import { useArchive } from "../store/ArchiveContext";
import { useI18n } from "../locales/i18n";
import { artistById } from "../data/artists";
import { useSocial } from "../store/SocialContext";
declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}
let instagramScript: Promise<void> | null = null;
function loadInstagram() {
  if (typeof window.instgrm?.Embeds?.process === "function")
    return Promise.resolve();
  if (!instagramScript)
    instagramScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        reject(Error("Embed timeout"));
      }, 12000);
      script.onload = () => {
        clearTimeout(timer);
        if (typeof window.instgrm?.Embeds?.process === "function") resolve();
        else {
          script.remove();
          reject(Error("Instagram embed SDK unavailable"));
        }
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(Error("Embed failed"));
      };
      document.body.appendChild(script);
    }).catch((e) => {
      instagramScript = null;
      throw e;
    });
  return instagramScript;
}
function OfficialEmbed({ item }: { item: SocialContent }) {
  const { t } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const knownRestriction = ["restricted", "failed"].includes(
    socialAvailability(item).embed,
  );
  useEffect(() => {
    let active = true;
    setFailed(false);
    setReady(false);
    const timer = setTimeout(() => {
      if (active) setFailed(true);
    }, 15000);
    if (item.platform === "instagram")
      loadInstagram()
        .then(() => {
          if (active) window.instgrm?.Embeds.process();
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.tiktok.com" ||
        event.source !== frame.current?.contentWindow ||
        !event.data?.["x-tiktok-player"]
      )
        return;
      if (event.data.type === "onPlayerReady") {
        clearTimeout(timer);
        setFailed(false);
        setReady(true);
      }
      if (
        event.data.type === "onPlayerError" ||
        event.data.type === "onError"
      ) {
        clearTimeout(timer);
        setFailed(true);
      }
    };
    window.addEventListener("message", receive);
    const observed = new Set<HTMLIFrameElement>();
    const observeFrame = () => {
      if (item.platform !== "instagram") return;
      for (const embedded of container.current?.querySelectorAll("iframe") ??
        []) {
        if (observed.has(embedded)) continue;
        observed.add(embedded);
        embedded.addEventListener(
          "load",
          () => {
            if (active) {
              clearTimeout(timer);
              setFailed(false);
              setReady(true);
            }
          },
          { once: true },
        );
        embedded.addEventListener(
          "error",
          () => {
            if (active) setFailed(true);
          },
          { once: true },
        );
      }
    };
    const observer = new MutationObserver(observeFrame);
    if (container.current)
      observer.observe(container.current, { subtree: true, childList: true });
    observeFrame();
    return () => {
      active = false;
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("message", receive);
    };
  }, [item]);
  return (
    <div ref={container} className={`official-embed embed-${item.platform}`}>
      {item.platform === "tiktok" ? (
        <iframe
          ref={frame}
          src={`${item.embedUrl}?controls=1&description=1&music_info=1&autoplay=0`}
          title={`TikTok · ${item.title ?? item.id}`}
          allow="fullscreen; encrypted-media"
          allowFullScreen
          onError={() => setFailed(true)}
        />
      ) : (
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={item.sourceUrl}
          data-instgrm-version="14"
        >
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
            {t("media.openOriginal")}
          </a>
        </blockquote>
      )}
      <p className="tiny-note" role="status">
        {t(
          failed ||
            (knownRestriction && item.platform === "instagram") ||
            (knownRestriction && !ready)
            ? "media.embedFailed"
            : ready
              ? item.contentType === "post"
                ? "media.postHelp"
                : item.platform === "instagram"
                  ? "media.embedShellReady"
                  : "media.embedHelp"
              : "media.embedLoading",
        )}
      </p>
    </div>
  );
}
export function SocialCard({ item }: { item: SocialContent }) {
  const { t, locale } = useI18n();
  const { isSaved, toggleSaved } = useArchive();
  const { activePlayerId, openPlayer, closePlayer } = useSocial();
  const loaded = activePlayerId === item.id;
  const [attempt, setAttempt] = useState(0);
  const availability = socialAvailability(item);
  useEffect(() => () => closePlayer(item.id), [item.id, closePlayer]);
  const label =
    item.title ??
    t(
      item.contentType === "reels"
        ? "media.reel"
        : item.contentType === "video-post"
          ? "media.videoPosts"
          : item.contentType === "post"
            ? "media.post"
            : "media.shortVideo",
    );
  return (
    <article className="social-card" data-content-id={item.id}>
      <div className="social-card-heading">
        <p className="eyebrow">
          {artistById(item.artistId)?.name ?? item.artistId} ·{" "}
          {item.platform === "instagram" ? "Instagram" : "TikTok"}
        </p>
        <button
          className="icon-button"
          type="button"
          aria-label={t(
            isSaved(item.id) ? "common.removeBookmark" : "common.bookmark",
            { title: label },
          )}
          aria-pressed={isSaved(item.id)}
          onClick={() => toggleSaved(item.id, "Watch Later", item.artistId)}
        >
          <Bookmark
            size={18}
            fill={isSaved(item.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <h3>{label}</h3>
      <p className="social-type-label">
        {t(
          item.contentType === "reels"
            ? "media.reelType"
            : item.contentType === "short-video"
              ? "media.tiktokType"
              : item.contentType === "video-post"
                ? "media.videoPosts"
                : "media.postType",
        )}{" "}
        ·{" "}
        {t(
          item.acquisitionMethod === "api"
            ? "discovery.apiContent"
            : "media.manual",
        )}
      </p>
      {item.description && <p>{item.description}</p>}
      <p className="tiny-note">
        {item.publishedAt
          ? new Intl.DateTimeFormat(locale, {
              timeZone: "Asia/Shanghai",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(item.publishedAt)) + " · UTC+8"
          : t("media.unknownDate")}
      </p>
      {availability.source !== "unavailable" ? (
        loaded ? (
          <OfficialEmbed key={attempt} item={item} />
        ) : (
          <div className="embed-consent">
            {["restricted", "failed"].includes(availability.embed) && (
              <p role="status">{t("media.embedFailed")}</p>
            )}
            <p>
              {t("media.embedPrivacy", {
                platform:
                  item.platform === "instagram" ? "Instagram" : "TikTok",
              })}
            </p>
            <button
              className="outline-button"
              type="button"
              onClick={() => openPlayer(item.id)}
            >
              {t(
                item.contentType === "post"
                  ? "media.loadPost"
                  : "media.loadEmbed",
              )}
            </button>
          </div>
        )
      ) : (
        <p role="status">{t("media.sourceUnavailable")}</p>
      )}
      {loaded && (
        <div className="official-source-actions">
          <button
            className="text-button"
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t("media.retryEmbed")}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => closePlayer(item.id)}
          >
            {t("media.closeEmbed")}
          </button>
        </div>
      )}
      <div className="official-source-actions">
        <a
          className="text-link"
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("media.openOriginal")} <ArrowUpRight size={16} />
        </a>
        <a
          className="text-link"
          href={item.officialAccountUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("media.account")}
        </a>
      </div>
      <details className="social-evidence">
        <summary>{t("media.evidence")}</summary>
        <p>{item.evidenceNote}</p>
        <p>
          {t("media.reviewed")}{" "}
          {new Intl.DateTimeFormat(locale, {
            timeZone: "Asia/Shanghai",
            dateStyle: "medium",
          }).format(new Date(item.lastValidatedAt))}
        </p>
        <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer">
          {t("media.evidenceLink")}
        </a>
      </details>
    </article>
  );
}
