// Offline workflow routing. No credentials, provider calls or data/ writes.
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function emptyRunSummary(mode, checkedAt) {
  return {
    mode,
    checkedAt,
    provider: "brightdata-tiktok-posts",
    requests: 0,
    connected: false,
    contentWrites: 0,
    sources: [],
    preview: [],
    budget: null,
    liveValidation: {
      requestSent: false,
      apiReturned: false,
      taskSubmitted: false,
      snapshotIds: [],
      resultDownloaded: false,
      returnedCount: null,
      authorValidated: false,
      newestPublishedAt: null,
      billingVerified: false,
      playerPlaybackVerified: false,
    },
    failedRecords: [],
  };
}

export function selectLaunch({
  event,
  ref,
  defaultBranch,
  requestedMode = "plan",
  scheduleEnabled,
} = {}) {
  const stopped = (mode, reason, message) => ({
    execute: false,
    mode,
    reason,
    message,
  });
  if (!["schedule", "workflow_dispatch"].includes(event))
    return stopped("plan", "UNSUPPORTED_EVENT", "此事件不能启动采集。");
  const mode = event === "schedule" ? "sync" : requestedMode;
  if (!["plan", "probe", "sync", "reconcile"].includes(mode))
    return stopped("plan", "INVALID_MODE", "未知运行模式，未执行采集。");
  if (mode === "plan")
    return { execute: true, mode, reason: null, message: "仅生成离线计划。" };
  if (!defaultBranch || ref !== `refs/heads/${defaultBranch}`)
    return stopped(mode, "DEFAULT_BRANCH_REQUIRED", "真实采集仅允许默认分支。");
  if (mode === "reconcile")
    return {
      execute: true,
      mode,
      reason: null,
      message: "仅核对已有 probe 及维护者提供的账单观察，不请求 Bright Data。",
    };
  if (mode === "sync" && scheduleEnabled !== "true")
    return stopped(mode, "SCHEDULE_NOT_ENABLED", "定时采集尚未启用。");
  return {
    execute: true,
    mode,
    reason: null,
    message:
      mode === "probe"
        ? "已选择 ITZY 单条探测；仍须通过许可、密钥和预算检查。"
        : "已选择六团同步；仍须通过许可、密钥和预算检查。",
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const launch = selectLaunch({
    event: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    defaultBranch: process.env.BRIGHTDATA_DEFAULT_BRANCH,
    requestedMode: process.env.REQUESTED_MODE || "plan",
    scheduleEnabled: process.env.BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED,
  });
  const summary = {
    ...emptyRunSummary(launch.mode, new Date().toISOString()),
    executionStatus: launch.execute ? "selected-not-executed" : "disabled",
    reason: launch.reason,
    message: launch.message,
  };
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/brightdata-summary.json",
    JSON.stringify(summary, null, 2) + "\n",
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `execute=${launch.execute}\nmode=${launch.mode}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${launch.message}\n\n当前步骤未调用供应商；不代表真实 API 成功。\n`,
    );
  console.log(JSON.stringify(summary));
}
