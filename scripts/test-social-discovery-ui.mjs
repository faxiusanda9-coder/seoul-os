// Controlled end-to-end engineering check; NOT a successful remote API call.
// Generated records live only in an isolated temporary data directory.
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { discoverSocial } from "./social-sync/discover.mjs";
import { launchBrowser, site } from "./verify-social-playback.mjs";
const root = await mkdtemp(join(tmpdir(), "seoul-discovery-ui-"));
let browser;
try {
  await cp(resolve("data"), join(root, "data"), { recursive: true });
  const result = await discoverSocial({
    root: join(root, "data"),
    platform: "instagram",
    artist: "twice",
    now: new Date().toISOString(),
    env: {
      INSTAGRAM_ACCESS_TOKEN: "PRIVATE_ENGINEERING_ONLY",
      INSTAGRAM_IG_USER_ID: "178414000000001",
    },
    fetcher: async () =>
      new Response(
        JSON.stringify({
          id: "178414000000001",
          business_discovery: {
            id: "178414000000002",
            username: "twicetagram",
            media: {
              data: [
                {
                  id: "180000000000001",
                  caption:
                    "TEST FIXTURE ONLY — automated pipeline engineering check",
                  media_type: "VIDEO",
                  media_product_type: "REELS",
                  permalink:
                    "https://www.instagram.com/reel/DiscoveryFIXTURE1/",
                  timestamp: new Date().toISOString(),
                },
              ],
            },
          },
        }),
        { status: 200 },
      ),
  });
  assert.equal(result.sources[0].state, "ok");
  execFileSync(process.execPath, [resolve("scripts/stage-public-data.mjs")], {
    cwd: root,
    stdio: "pipe",
  });
  const items = await readFile(
    join(root, "public/data/social/instagram/items.json"),
    "utf8",
  );
  const status = await readFile(
    join(root, "public/data/status/social-discovery.json"),
    "utf8",
  );
  assert.ok(!items.includes("PRIVATE_ENGINEERING_ONLY"));
  browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https:\/\/www\.(instagram|tiktok)\.com/.test(r.url()))
      external.push(r.url());
  });
  await page.goto(`${site}#/media?artist=itzy&platform=instagram`, {
    waitUntil: "networkidle",
  });
  await page
    .locator(".discovery-status summary")
    .getByText("自动发现尚未开通", { exact: false })
    .waitFor();
  assert.equal(await page.locator(".social-grid > .social-card").count(), 5);
  await page.locator(".discovery-status summary").click();
  await page
    .getByText("未完成远程检查，不计为新增 0 条", { exact: true })
    .waitFor();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: resolve("test-results/phase32-not-configured.png"),
    fullPage: false,
  });
  await page.route("**/data/social/instagram/items.json", (r) =>
    r.fulfill({ contentType: "application/json", body: items }),
  );
  await page.route("**/data/status/social-discovery.json", (r) =>
    r.fulfill({ contentType: "application/json", body: status }),
  );
  await page.goto(`${site}#/media?artist=twice&platform=instagram`, {
    waitUntil: "networkidle",
  });
  const card = page.locator('[data-content-id="ig-DiscoveryFIXTURE1"]');
  await card.getByText("官方接口获取", { exact: false }).waitFor();
  await page
    .locator(".discovery-status summary")
    .getByText("最近自动检查", { exact: false })
    .waitFor();
  assert.equal(
    await card
      .getByRole("link", { name: "打开原始内容", exact: false })
      .getAttribute("href"),
    "https://www.instagram.com/reel/DiscoveryFIXTURE1/",
  );
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(external.length, 0);
  await page.locator(".media-search input").fill("TEST FIXTURE ONLY");
  assert.equal(await page.locator(".social-grid > .social-card").count(), 1);
  await card.getByRole("button", { name: /^收藏 / }).click();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await card
      .getByRole("button", { name: /取消收藏/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  for (const width of [375, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.goto(`${site}#/archive`, { waitUntil: "networkidle" });
  await card.waitFor();
  await page.unroute("**/data/status/social-discovery.json");
  await page.route("**/data/status/social-discovery.json", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto(`${site}#/media?artist=twice&platform=instagram`, {
    waitUntil: "networkidle",
  });
  await page.getByText("自动发现状态暂时无法读取。", { exact: true }).waitFor();
  await card.waitFor();
  assert.deepEqual(errors, []);
  const evidence = {
    checkedAt: new Date().toISOString(),
    mode: "controlled engineering fixtures; NOT real platform discovery or video playback",
    passed: true,
    checks: [
      "real unconfigured status, five existing ITZY entries retained, no false zero-new success",
      "controlled response through adapter -> atomic data -> actual stage script -> rendered API card",
      "status success, source link, search, bookmark/refresh/Archive",
      "no third-party player requests before consent; 375/390/412px no overflow",
      "discovery status 503 isolated from content and navigation",
    ],
    errors,
  };
  await writeFile(
    "test-results/social-discovery-ui.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
  await rm(root, { recursive: true, force: true });
}
