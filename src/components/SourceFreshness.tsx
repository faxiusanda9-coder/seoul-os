import { useEffect, useState } from "react";
import {
  parseSyncStatus,
  type SourceStatus,
} from "../../data/schemas/sync-status.schema";
import { useI18n } from "../locales/i18n";
export function SourceFreshness({
  artistId,
  platform,
  snapshotAt,
}: {
  artistId: string;
  platform: SourceStatus["platform"];
  snapshotAt?: string | null;
}) {
  const [state, setState] = useState<{
    key: string;
    source: SourceStatus | null;
  }>({ key: "", source: null });
  const { t, locale } = useI18n();
  const key = `${platform}:${artistId}`;
  useEffect(() => {
    const abort = new AbortController();
    setState({ key, source: null });
    fetch(`${import.meta.env.BASE_URL}data/status/${platform}.json`, {
      cache: "no-cache",
      signal: abort.signal,
    })
      .then(async (r) => (r.ok ? parseSyncStatus(await r.json()) : null))
      .then((s) => {
        if (!abort.signal.aborted)
          setState({
            key,
            source: s?.sources.find((s) => s.sourceId === key) ?? null,
          });
      })
      .catch(() => {});
    return () => abort.abort();
  }, [key, platform]);
  const s = state.key === key ? state.source : null;
  const date = (v: string | null) =>
    v
      ? new Intl.DateTimeFormat(locale, {
          timeZone: "Asia/Shanghai",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(v))
      : t("media.unrecorded");
  const stale =
    s?.lastSuccessAt &&
    Date.now() - Date.parse(s.lastSuccessAt) > 36 * 60 * 60 * 1000;
  return (
    <details className="source-freshness">
      <summary>
        {t(platform === "youtube" ? "media.apiCheck" : "media.localCheck")} ·{" "}
        {date(s?.lastSuccessAt ?? null)}
        {s && (s.status !== "ok" || stale)
          ? ` · ${t("media.checkWarning")}`
          : ""}
      </summary>
      <p>
        {t(platform === "youtube" ? "media.apiMeaning" : "media.localMeaning")}
      </p>
      <dl>
        <dt>{t("media.attempt")}</dt>
        <dd>{date(s?.lastAttemptAt ?? null)}</dd>
        <dt>{t("media.success")}</dt>
        <dd>{date(s?.lastSuccessAt ?? null)}</dd>
        <dt>{t("media.changed")}</dt>
        <dd>{date(s?.lastContentChangeAt ?? null)}</dd>
        {snapshotAt && (
          <>
            <dt>{t("media.snapshot")}</dt>
            <dd>{date(snapshotAt)}</dd>
          </>
        )}
        <dt>{t("media.counts")}</dt>
        <dd>
          {s ? `${s.newCount} / ${s.updatedCount}` : t("media.unrecorded")}
        </dd>
      </dl>
      {s?.failedSources.length ? (
        <p role="status">
          {t("media.sourceFailed")} ·{" "}
          {s.failedSources.map((f) => f.error).join("; ")}
        </p>
      ) : null}
      {!s && <p>{t("media.statusUnavailable")}</p>}
    </details>
  );
}
