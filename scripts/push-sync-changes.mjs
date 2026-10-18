import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const scopes = {
  'brightdata-budget': ['data/usage/brightdata-tiktok.json'],
  'brightdata': ['data/social/tiktok/items.json', 'data/status/brightdata-tiktok.json'],
  social: [
    "data/social/instagram/items.json",
    "data/social/tiktok/items.json",
    "data/status/social-discovery.json",
    "data/status/instagram.json",
    "data/status/tiktok.json",
  ],
  youtube: ["data/youtube", "data/status/youtube.json"],
};
// Rebase independent generated changes; stop on conflicts, never overwrite JSON.
export function pushSyncChanges({
  scope,
  run = (args) =>
    execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
}) {
  const paths = scopes[scope];
  if (!paths) throw Error("Invalid sync scope");
  if (run(["branch", "--show-current"]).trim() !== "main")
    throw Error("Sync publishing requires main");
  if (run(["diff", "--cached", "--name-only"]).trim())
    throw Error("Unexpected staged changes");
  if (!run(["status", "--porcelain", "--", ...paths]).trim()) return false;
  run(["add", "--", ...paths]);
  run([
    "commit",
    "-m",
    scope === "youtube"
      ? "data: sync independent official YouTube channels"
      : scope === 'brightdata-budget'
        ? 'data: reserve Bright Data free record budget before request'
        : scope === 'brightdata'
          ? 'data: sync third-party TikTok metadata and budget status'
          : "data: sync official social content and discovery status",
  ]);
  for (let n = 0; n < 3; n++) {
    try {
      run(["pull", "--rebase", "origin", "main"]);
    } catch {
      try {
        run(["rebase", "--abort"]);
      } catch {}
      throw Error("Concurrent content conflict; no data was overwritten");
    }
    try {
      run(["push", "origin", "HEAD:main"]);
      return true;
    } catch {
      if (n === 2) throw Error("Concurrent push failed after bounded retries");
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    pushSyncChanges({ scope: process.argv[2] });
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
