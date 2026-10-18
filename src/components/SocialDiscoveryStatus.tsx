import { useEffect, useState } from "react";
import {
  parseDiscoveryStatus,
  discoveryIsStale,
  type DiscoverySource,
} from "../../data/schemas/social-discovery.schema";
import { verifiedMediaAccounts } from "../data/social";
import { useI18n } from "../locales/i18n";
export function SocialDiscoveryStatus({
  artistId,
  platform,
}: {
  artistId: string;
  platform: "instagram" | "tiktok";
}) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<{
    key: string;
    source: DiscoverySource | null;
    loaded: boolean;
  }>({ key: "", source: null, loaded: false });
  const key = `${platform}:${artistId}`;
  const verified = verifiedMediaAccounts.some(
    (a) => a.artistId === artistId && a.platform === platform,
  );
  useEffect(() => {
    const abort = new AbortController();
    setView({ key, source: null, loaded: false });
    fetch(`${import.meta.env.BASE_URL}data/status/social-discovery.json`, {
      cache: "no-cache",
      signal: abort.signal,
    })
      .then(async (r) =>
        r.ok
          ? parseDiscoveryStatus(await r.json(), verifiedMediaAccounts)
          : null,
      )
      .then((data) => {
        if (!abort.signal.aborted)
          setView({
            key,
            source: data?.sources.find((s) => s.sourceId === key) ?? null,
            loaded: true,
          });
      })
      .catch(() => {
        if (!abort.signal.aborted) setView({ key, source: null, loaded: true });
      });
    return () => abort.abort();
  }, [key]);
  const source = view.key === key ? view.source : null;
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          timeZone: "Asia/Shanghai",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : t("media.unrecorded");
  const message = !verified
    ? t("discovery.accountUnknown")
    : !source
      ? t(
          view.loaded && view.key === key
            ? "discovery.statusUnavailable"
            : "media.loading",
        )
      : source.state === "ok"
        ? `${t("discovery.checked")} · ${date(source.lastSuccessAt)}${discoveryIsStale(source) ? ` · ${t("media.checkWarning")}` : ""}`
        : t(
            source.state === "not-configured"
              ? "discovery.notConfigured"
              : source.state === "auth-required"
                ? "discovery.authRequired"
                : source.state === "disabled"
                  ? "discovery.disabled"
                  : "discovery.failed",
          );
  return (
    <details
      className="source-freshness discovery-status"
      data-discovery-state={source?.state ?? "unknown"}
    >
      <summary>{message}</summary>
      <p>
        {t(
          source?.state === "ok"
            ? "discovery.schedule"
            : "discovery.pendingSchedule",
        )}
      </p>
      <p>{t("discovery.meaning")}</p>
      {source && (
        <dl>
          <dt>{t("media.attempt")}</dt>
          <dd>{date(source.lastAttemptAt)}</dd>
          <dt>{t("discovery.success")}</dt>
          <dd>{date(source.lastSuccessAt)}</dd>
          <dt>{t("media.changed")}</dt>
          <dd>{date(source.lastContentChangeAt)}</dd>
          <dt>{t("media.counts")}</dt>
          <dd>
            {source.newCount === null
              ? t("discovery.notChecked")
              : `${source.newCount} / ${source.updatedCount}`}
          </dd>
        </dl>
      )}
    </details>
  );
}
