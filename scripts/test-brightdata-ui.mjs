// Isolated engineering fixtures. Never a live Bright Data or video-playback test.
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { launchBrowser, site } from "./verify-social-playback.mjs";
import { syncBrightData } from "./brightdata-tiktok/sync.mjs";
const temp = await mkdtemp(join(tmpdir(), "seoul-brightdata-ui-"));
let browser;
const checks = [];
const currentTikTok = JSON.parse(
  await readFile("data/social/tiktok/items.json", "utf8"),
);
const expectedItzy = currentTikTok.items.filter(
  (i) => i.artistId === "itzy",
).length;
try {
  await cp(resolve("data"), join(temp, "data"), { recursive: true });
  const now = new Date().toISOString(),
    month = now.slice(0, 7);
  const nextMonth = new Date(
    Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth() + 1,
      1,
    ),
  ).toISOString();
  const fixtureId = "7686800836638330121";
  const providerFixture = async (url, options) => {
    if (url.includes("/trigger"))
      return new Response(JSON.stringify({ snapshot_id: "sd_UIFIXTURE123" }));
    if (url.includes("/progress/"))
      return new Response(
        JSON.stringify({
          snapshot_id: "sd_UIFIXTURE123",
          dataset_id: "gd_lu702nij2f790tmv9h",
          status: "ready",
        }),
      );
    return new Response(
      JSON.stringify([
        {
          url: `https://www.tiktok.com/@itzyofficial/video/${fixtureId}`,
          post_id: fixtureId,
          profile_username: "ITZY",
          account_id: "itzyofficial",
          profile_url: "https://www.tiktok.com/@itzyofficial/",
          post_type: "video",
          create_time: now,
        },
      ]),
    );
  };
  const result = await syncBrightData({
    root: join(temp, "data"),
    mode: "sync",
    artist: "itzy",
    env: {
      BRIGHT_DATA_API_KEY: "PRIVATE_ENGINEERING_FIXTURE_ONLY",
      BRIGHTDATA_TIKTOK_ENABLED: "true",
      BRIGHTDATA_ZERO_COST_APPROVAL_JSON: JSON.stringify({
        schemaVersion: 1,
        month,
        confirmedAt: now,
        expiresAt: nextMonth,
        accountRef: "UI_TEST_ONLY",
        accountExclusive: true,
        freeTierEligible: true,
        depositedBalanceUsd: 0,
        autoRecharge: false,
        serverFreeTierHardStop: true,
        paidSpendLimitUsd: 0,
        publicMetadataUseApproved: true,
        permissionEvidenceRef: "SIMULATED - NOT REAL PERMISSION",
        billingEvidenceRef: "SIMULATED - NOT REAL BILLING",
        freeCreditsRemaining: 4000,
        baselineReservedRecords: 0,
      }),
    },
    fetcher: providerFixture,
  });
  assert.equal(result.sources[0].newCount, 1);
  execFileSync(process.execPath, [resolve("scripts/stage-public-data.mjs")], {
    cwd: temp,
    stdio: "pipe",
  });
  const stagedItems = await readFile(
    join(temp, "public/data/social/tiktok/items.json"),
    "utf8",
  );
  const stagedStatus = await readFile(
    join(temp, "public/data/status/brightdata-tiktok.json"),
    "utf8",
  );
  assert.ok(!stagedItems.includes("PRIVATE_ENGINEERING_FIXTURE_ONLY"));
  assert.ok(!stagedStatus.includes("UI_TEST_ONLY"));
  browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https:\/\/www\.(tiktok|instagram)\.com/.test(r.url()))
      external.push(r.url());
  });
  const url = site + "#/media?artist=itzy&platform=tiktok";
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByText("Bright Data 尚未接通", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".social-grid > .social-card").count(),
    expectedItzy,
  );
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(external.length, 0);
  await page.locator(".brightdata-status summary").click();
  await page
    .getByText("付费上限 $0；实际账单未通过 API 核实", { exact: true })
    .waitFor();
  checks.push(
    `Real not-configured status, ${expectedItzy} existing ITZY cards, no false discovery or billing success`,
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: resolve("test-results/brightdata-not-connected-mobile.png"),
    fullPage: false,
  });
  await page.route("**/data/social/tiktok/items.json", (r) =>
    r.fulfill({ contentType: "application/json", body: stagedItems }),
  );
  await page.route("**/data/status/brightdata-tiktok.json", (r) =>
    r.fulfill({ contentType: "application/json", body: stagedStatus }),
  );
  await page.reload({ waitUntil: "networkidle" });
  const card = page.locator(`[data-content-id="tt-${fixtureId}"]`);
  await card
    .getByText("Bright Data 第三方获取 · 作者匹配", { exact: false })
    .waitFor();
  await card.locator(".social-evidence summary").click();
  assert.ok(
    (await card.locator(".social-evidence").innerText()).includes(
      "第三方元数据作者匹配于",
    ),
  );
  assert.ok(
    !(await card.locator(".social-evidence").innerText()).includes(
      "内容人工核验于",
    ),
  );
  await page
    .getByText("Bright Data 第三方检查已完成", { exact: true })
    .waitFor();
  assert.equal(
    await card
      .getByRole("link", { name: "打开原始内容", exact: false })
      .getAttribute("href"),
    `https://www.tiktok.com/@itzyofficial/video/${fixtureId}`,
  );
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(external.length, 0);
  checks.push(
    "Controlled adapter -> isolated data -> actual build stage -> third-party card and independent status; no official API label",
  );
  await page.route("https://www.tiktok.com/player/v1/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>CONTROLLED ENGINEERING SHELL - NO VIDEO</title><button onclick="parent.postMessage({'x-tiktok-player':true,type:'onPlayerError'},'*')">Simulate player failure</button>`,
    }),
  );
  await card.getByRole("button", { name: "在站内播放", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".official-embed iframe").length === 1,
  );
  assert.ok(
    (await card.locator("iframe").getAttribute("src")).startsWith(
      `https://www.tiktok.com/player/v1/${fixtureId}?`,
    ),
  );
  const frame = page
    .frames()
    .find((f) => f.url().includes("/player/v1/" + fixtureId));
  assert.ok(frame);
  await frame.getByRole("button", { name: "Simulate player failure" }).click();
  await card
    .getByText("站内播放暂不可用，原视频可能仍可访问。", { exact: true })
    .waitFor();
  assert.ok(
    await card
      .getByRole("link", { name: "打开原始内容", exact: false })
      .isVisible(),
  );
  // Match the existing accessible keyboard regression. In this Edge/headless
  // setup a pointer action after the cross-origin fixture can miss the host;
  // this check does not claim real mobile touch-close or real video playback.
  await card.getByRole("button", { name: "关闭播放器", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelectorAll("iframe").length === 0,
  );
  assert.equal(await page.locator("iframe").count(), 0);
  checks.push(
    "Explicit consent mounts one official single-video URL; controlled player error preserves original link; keyboard close unmounts (real touch close unverified)",
  );
  await card.getByRole("button", { name: /^收藏 / }).click();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await card
      .getByRole("button", { name: /取消收藏/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.goto(site + "#/archive", { waitUntil: "networkidle" });
  await card.waitFor();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".media-search input").fill("ITZY");
  await card.waitFor();
  for (const width of [375, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  checks.push(
    "Stable bookmark ID survives refresh and Archive; artist search and 375/390/412px layout",
  );
  await page.unroute("**/data/status/brightdata-tiktok.json");
  await page.route("**/data/status/brightdata-tiktok.json", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByText("Bright Data 状态暂时无法读取", { exact: true })
    .waitFor();
  await card.waitFor();
  await page.goto(site, { waitUntil: "networkidle" });
  await page.locator(".feed-card").first().waitFor();
  assert.equal(await page.locator(".feed-card").count(), 50);
  assert.deepEqual(errors, []);
  checks.push(
    "Status failure isolated from content; home YouTube feed retained; no page errors",
  );
  const proof = {
    checkedAt: new Date().toISOString(),
    mode: "controlled engineering fixtures; NOT a live Bright Data call, license confirmation, actual bill or video playback",
    passed: true,
    checks,
  };
  await writeFile(
    "test-results/brightdata-ui.json",
    JSON.stringify(proof, null, 2) + "\n",
  );
  console.log(JSON.stringify(proof, null, 2));
} finally {
  if (browser) await browser.close();
  assert.ok(resolve(temp).startsWith(resolve(tmpdir()) + sep));
  await rm(temp, { recursive: true, force: true });
}
