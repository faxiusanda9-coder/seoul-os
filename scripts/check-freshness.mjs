import { resolve } from "node:path";
import { readStatus } from "./sync-status.mjs";
import { loadChannels } from "./youtube-sync.mjs";
import { loadSocialAccounts } from "./social-sync/index.mjs";
import { readDiscovery } from "./social-sync/discover.mjs";
import { discoveryIsStale } from "../data/schemas/social-discovery.schema.ts";
const now = Date.now();
let failures = 0;
for (const platform of ["youtube", "instagram", "tiktok"]) {
  const { sources } = await readStatus(resolve(`data/status/${platform}.json`));
  for (const c of (await loadChannels()).filter((c) => c.enabled)) {
    const s = sources.find((s) => s.artistId === c.artistId);
    if (!s?.lastSuccessAt)
      console.log(
        `::warning::${platform}:${c.artistId} has no recorded successful ${platform === "youtube" ? "API check" : "local manifest validation"}`,
      );
    else if (now - Date.parse(s.lastSuccessAt) > 36 * 60 * 60 * 1000) {
      console.log(`::warning::${s.sourceId} last success older than 36 hours`);
      failures++;
    }
    if (
      s?.status === "failed" ||
      s?.status === "skipped" ||
      s?.status === "running"
    ) {
      console.log(`::warning::${s.sourceId} status=${s.status}`);
      failures++;
    }
  }
}
console.log(
  `Freshness monitor: ${failures} stale or failed sources; manual manifests do not indicate current platform availability.`,
);
const discovery = await readDiscovery(
  resolve("data"),
  await loadSocialAccounts(),
);
let pending = 0;
for (const source of discovery.sources) {
  if (source.state === "not-configured" || source.state === "disabled") {
    pending++;
    continue;
  }
  if (source.state !== "ok" || discoveryIsStale(source, now)) {
    console.log(
      `::warning::${source.sourceId} automatic discovery is ${source.state === "ok" ? "overdue for its scheduled slot" : source.state}`,
    );
    failures++;
  }
}
console.log(
  `Automatic discovery: ${pending} unconfigured/disabled sources; local validation is not remote discovery. Schedule 08:00/12:00/20:00 Beijing, one hour grace.`,
);
if (failures) process.exitCode = 1;
