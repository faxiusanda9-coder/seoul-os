import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { OfficialSocialAccount } from "../types/official";
import { useI18n } from "../locales/i18n";

type XWidgets = { widgets: {
  createTimeline: (source: { sourceType: "profile"; screenName: string },
    target: HTMLElement, options: { theme: "light"; height: number; chrome: string; dnt: true }) => Promise<HTMLElement | undefined>;
} };
declare global { interface Window { twttr?: XWidgets } }

let widgetScript: Promise<void> | undefined;
function loadWidgetScript(): Promise<void> {
  if (window.twttr?.widgets) return Promise.resolve();
  if (!widgetScript) widgetScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); widgetScript = undefined; reject(new Error("X widget script failed")); };
    document.head.append(script);
  });
  return widgetScript;
}

export function OfficialXTimeline({ account }: { account: OfficialSocialAccount }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state !== "loading") return;
    let active = true;
    const timeout = window.setTimeout(() => { if (active) setState("failed"); }, 12000);
    loadWidgetScript()
      .then(async () => {
        if (!active || !target.current || !window.twttr?.widgets) throw new Error("X widget unavailable");
        target.current.replaceChildren();
        const node = await window.twttr.widgets.createTimeline(
          { sourceType: "profile", screenName: account.accountHandle },
          target.current, { theme: "light", height: 470, chrome: "noheader nofooter", dnt: true },
        );
        if (!node) throw new Error("X timeline unavailable");
        if (active) setState("loaded");
      })
      .catch(() => { if (active) setState("failed"); });
    return () => { active = false; window.clearTimeout(timeout); };
  }, [account.accountHandle, state]);
  return <section className="content-section official-x-section">
    <div className="section-heading"><div><p className="eyebrow">OFFICIAL SOCIAL / X</p>
      <h2>From the artist.</h2><p className="section-note">{t("official.xIntro")}</p></div></div>
    <div className="official-x-box">
      <p>{t("official.xPrivacy")}</p>
      <a className="text-link official-x-privacy-link" href="https://help.x.com/en/rules-and-policies/x-cookies" target="_blank" rel="noopener noreferrer">
        {t("official.xChoices")} <ArrowUpRight size={16} />
      </a>
      {state === "idle" && <button type="button" className="outline-button" onClick={() => setState("loading")}>
        {t("official.loadX")}
      </button>}
      {state === "loading" && <p role="status">{t("official.xLoading")}</p>}
      {state === "failed" && <p role="status">{t("official.xFailed")}</p>}
      <div ref={target} className="official-x-embed" aria-label={t("official.xTimeline", { handle: account.accountHandle })} />
      <a className="text-link" href={account.accountUrl} target="_blank" rel="noopener noreferrer">
        {t("official.openX", { handle: account.accountHandle })} <ArrowUpRight size={17} />
      </a>
    </div>
  </section>;
}
