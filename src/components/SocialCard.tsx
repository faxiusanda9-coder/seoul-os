import { useEffect, useRef, useState } from "react";
import { Bookmark, ArrowUpRight } from "lucide-react";
import type { SocialContent } from "../../data/schemas/social.schema";
import { useArchive } from "../store/ArchiveContext";
import { useI18n } from "../locales/i18n";
declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}
let instagramScript: Promise<void> | null = null;
function loadInstagram() {
  if (window.instgrm) return Promise.resolve();
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
        resolve();
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
  useEffect(() => {
    let active = true;
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
      }
      if (event.data.type === "onPlayerError" || event.data.type === "onError")
        setFailed(true);
    };
    window.addEventListener("message", receive);
    const observer = new MutationObserver(() => {
      if (container.current?.querySelector("iframe")) clearTimeout(timer);
    });
    if (container.current)
      observer.observe(container.current, { subtree: true, childList: true });
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
          src={item.embedUrl}
          title={`TikTok · ${item.title ?? item.id}`}
          allow="fullscreen"
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
        {t(failed ? "media.embedFailed" : "media.embedHelp")}
      </p>
    </div>
  );
}
export function SocialCard({ item }: { item: SocialContent }) {
  const { t, locale } = useI18n();
  const { isSaved, toggleSaved } = useArchive();
  const [loaded, setLoaded] = useState(false);
  const label =
    item.title ??
    t(
      item.contentType === "reels"
        ? "media.reel"
        : item.contentType === "post"
          ? "media.post"
          : "media.shortVideo",
    );
  return (
    <article className="social-card">
      <div className="social-card-heading">
        <p className="eyebrow">
          {item.platform === "instagram" ? "Instagram" : "TikTok"} ·{" "}
          {t("media.manual")}
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
      {item.availabilityStatus === "available" ||
      item.availabilityStatus === "unknown" ? (
        loaded ? (
          <OfficialEmbed item={item} />
        ) : (
          <div className="embed-consent">
            <p>
              {t("media.embedPrivacy", {
                platform:
                  item.platform === "instagram" ? "Instagram" : "TikTok",
              })}
            </p>
            <button
              className="outline-button"
              type="button"
              onClick={() => setLoaded(true)}
            >
              {t("media.loadEmbed")}
            </button>
          </div>
        )
      ) : (
        <p role="status">{t("media.restricted")}</p>
      )}
      {loaded && (
        <button
          className="text-button"
          type="button"
          onClick={() => setLoaded(false)}
        >
          {t("media.closeEmbed")}
        </button>
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
