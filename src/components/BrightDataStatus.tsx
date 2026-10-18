import { useEffect, useState } from "react";
import {
  parseBrightDataStatus,
  brightDataOverdue,
  TIKTOK_AUTO_ARTISTS,
  type BrightDataStatus as Status,
} from "../../data/schemas/brightdata.schema";
import { verifiedMediaAccounts } from "../data/social";
import { useI18n } from "../locales/i18n";

export function BrightDataStatus({ artistId }: { artistId: string }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Status | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/status/brightdata-tiktok.json`, {
      cache: "no-cache",
      signal: abort.signal,
    })
      .then(async (r) =>
        r.ok
          ? parseBrightDataStatus(await r.json(), verifiedMediaAccounts)
          : null,
      )
      .then((d) => {
        if (!abort.signal.aborted) setData(d);
      })
      .catch(() => {
        if (!abort.signal.aborted) setData(null);
      });
    return () => abort.abort();
  }, []);
  const s = data?.sources.find((s) => s.artistId === artistId);
  if (!TIKTOK_AUTO_ARTISTS.some((id) => id === artistId))
    return <p className="tiny-note">{t("brightdata.outOfScope")}</p>;
  if (
    !verifiedMediaAccounts.some(
      (a) => a.artistId === artistId && a.platform === "tiktok",
    )
  )
    return null;
  const date = (v: string | null | undefined) =>
    v
      ? new Intl.DateTimeFormat(locale, {
          timeZone: "Asia/Shanghai",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(v))
      : t("media.unrecorded");
  return (
    <details
      className="source-freshness brightdata-status"
      data-brightdata-state={s?.state ?? "unknown"}
    >
      <summary>
        {t(
          s?.state === "ok"
            ? "brightdata.checked"
            : s?.state === "failed"
              ? "brightdata.failed"
              : s?.state === "blocked"
                ? "brightdata.blocked"
                : s?.state === "not-configured"
                  ? "brightdata.notConfigured"
                  : "brightdata.unavailable",
        )}
        {s?.state === "ok" && brightDataOverdue(s)
          ? ` · ${t("media.checkWarning")}`
          : ""}
      </summary>
      <p>{t("brightdata.meaning")}</p>
      <p>{t("brightdata.schedule")}</p>
      <dl>
        <dt>{t("media.attempt")}</dt>
        <dd>{date(s?.lastAttemptAt)}</dd>
        <dt>{t("brightdata.success")}</dt>
        <dd>{date(s?.lastSuccessAt)}</dd>
        <dt>{t("media.changed")}</dt>
        <dd>{date(s?.lastContentChangeAt)}</dd>
        <dt>{t("media.counts")}</dt>
        <dd>
          {s?.newCount == null
            ? t("discovery.notChecked")
            : `${s.newCount} / ${s.updatedCount}`}
        </dd>
        <dt>{t("brightdata.budget")}</dt>
        <dd>
          {data
            ? `${data.budget.reservedRecords} / ${data.budget.recordLimit}`
            : t("media.unrecorded")}
        </dd>
        <dt>{t("brightdata.remaining")}</dt>
        <dd>{data?.budget.remainingRecords ?? t("media.unrecorded")}</dd>
        <dt>{t("brightdata.confirmation")}</dt>
        <dd>{date(data?.budget.confirmationValidUntil)}</dd>
        <dt>{t("brightdata.paid")}</dt>
        <dd>{t("brightdata.paidUnknown")}</dd>
      </dl>
      <p className="tiny-note">{t("brightdata.reservationMeaning")}</p>
      {s?.error && (
        <p role="status">
          {t("brightdata.reason")}: {s.error}
        </p>
      )}
    </details>
  );
}
