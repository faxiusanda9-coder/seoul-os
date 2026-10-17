import { useEffect, useRef, useState } from "react";
import type { SocialAccount } from "../../data/schemas/social.schema";
import { useI18n } from "../locales/i18n";
import { useSocial } from "../store/SocialContext";
/** Official Creator Profile Embed; its videos stay inside TikTok, outside our local manifest. */
export function TikTokProfile({ account }: { account: SocialAccount }) {
  const { t } = useI18n();
  const { activePlayerId, openPlayer, closePlayer } = useSocial();
  const playerId = `profile:${account.platform}:${account.handle}`;
  const allowed = activePlayerId === playerId;
  const [failed, setFailed] = useState(false);
  useEffect(() => () => closePlayer(playerId), [playerId, closePlayer]);
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!allowed || !target.current) return;
    const host = target.current;
    setFailed(false);
    const block = document.createElement("blockquote");
    block.className = "tiktok-embed";
    block.cite = account.accountUrl;
    block.dataset.uniqueId = account.handle;
    block.dataset.embedType = "creator";
    block.style.maxWidth = "720px";
    block.style.minWidth = "0";
    const section = document.createElement("section"),
      link = document.createElement("a");
    link.href = account.accountUrl;
    link.textContent = `@${account.handle}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    section.append(link);
    block.append(section);
    host.append(block);
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    let active = true;
    const timer = setTimeout(() => {
      if (active) setFailed(true);
    }, 15000);
    script.onerror = () => {
      if (active) setFailed(true);
    };
    host.append(script);
    const observer = new MutationObserver(() => {
      if (host.querySelector("iframe")) clearTimeout(timer);
    });
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      active = false;
      clearTimeout(timer);
      observer.disconnect();
      host.replaceChildren();
    };
  }, [allowed, account]);
  return (
    <div className="tiktok-profile social-card">
      <p className="eyebrow">TikTok · {t("media.platformPreview")}</p>
      <h3>@{account.handle}</h3>
      <p>{t("media.profileMeaning")}</p>
      {!allowed ? (
        <div className="embed-consent">
          <p>{t("media.embedPrivacy", { platform: "TikTok" })}</p>
          <button
            className="outline-button"
            type="button"
            onClick={() => openPlayer(playerId)}
          >
            {t("media.loadProfile")}
          </button>
        </div>
      ) : (
        <>
          <div ref={target} className="tiktok-profile-embed" />
          <p className="tiny-note" role="status">
            {t(failed ? "media.embedFailed" : "media.embedHelp")}
          </p>
          <button
            className="text-button"
            type="button"
            onClick={() => closePlayer(playerId)}
          >
            {t("media.closeEmbed")}
          </button>
        </>
      )}
      <a
        className="text-link"
        href={account.accountUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("media.account")} ↗
      </a>
    </div>
  );
}
