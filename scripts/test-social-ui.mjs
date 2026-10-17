// Controlled engineering tests. Network fixtures do NOT constitute real playback evidence.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, site } from "./verify-social-playback.mjs";
const ig = JSON.parse(
  await readFile("data/social/instagram/items.json", "utf8"),
).items;
const tt = JSON.parse(
  await readFile("data/social/tiktok/items.json", "utf8"),
).items;
const igVideos = ig.filter(
  (i) =>
    i.artistId === "twice" &&
    i.contentType === "reels" &&
    i.availabilityStatus === "available",
);
const ttVideos = tt.filter(
  (i) => i.artistId === "twice" && i.availabilityStatus === "available",
);
assert.ok(
  igVideos.length >= 2 && ttVideos.length >= 2,
  "Need reviewed production content for UI regression",
);
const browser = await launchBrowser(),
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
const errors = [],
  external = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https:\/\/www\.(instagram|tiktok)\.com/.test(r.url()))
    external.push(r.url());
});
await page.addInitScript(() => {
  if (!localStorage.getItem("seoul-os-archive-v1"))
    localStorage.setItem(
      "seoul-os-archive-v1",
      JSON.stringify([
        { id: "yt-jcmVRR_BnZU", category: "Watch Later", artistId: "twice" },
      ]),
    );
});
const goto = async (p = "instagram", artist = "twice") => {
  await page.goto(`${site}#/media?artist=${artist}&platform=${p}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector(".media-panel");
};
const card = (id) => page.locator(`[data-content-id="${id}"]`);
const play = async (item) => {
  const button = card(item.id).getByRole("button", {
    name: item.contentType === "post" ? "在站内查看" : "在站内播放",
    exact: true,
  });
  await button.scrollIntoViewIfNeeded();
  await button.focus();
  await page.keyboard.press("Enter");
};
const frameCount = async (n) => {
  await page.waitForFunction(
    (n) => document.querySelectorAll(".official-embed iframe").length === n,
    n,
  );
};
const igScript = `window.instgrm={Embeds:{process(){document.querySelectorAll('blockquote.instagram-media').forEach(b=>{const f=document.createElement('iframe');f.src=b.dataset.instgrmPermalink+'embed/';f.title='Instagram official embed test fixture';f.style.width='100%';f.style.height='420px';b.replaceWith(f);});}}};`;
try {
  await page.route("https://www.instagram.com/embed.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: igScript }),
  );
  await page.route("https://www.instagram.com/**/embed/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Controlled Instagram shell only</title><p>Engineering fixture; no video playback assertion</p>",
    }),
  );
  await page.route("https://www.tiktok.com/player/v1/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>Controlled TikTok messages only</title><button onclick="parent.postMessage({'x-tiktok-player':true,type:'onPlayerReady'},'*')">Ready</button><button onclick="parent.postMessage({'x-tiktok-player':true,type:'onPlayerError'},'*')">Error</button>`,
    }),
  );
  await goto();
  await card(igVideos[0].id).waitFor();
  assert.equal(
    await page.locator(".social-grid > .social-card").count(),
    ig.filter((i) => i.artistId === "twice").length,
  );
  assert.equal(external.length, 0);
  assert.equal(await page.locator("iframe").count(), 0);
  assert.ok(
    (await card("ig-DYtXsHuPvZ0").innerText()).includes("发布时间未知"),
  );
  assert.equal(
    await card("ig-DYtXsHuPvZ0").locator("h3").innerText(),
    "Instagram Reel",
  );
  checks.push(
    "default includes real posts; no requests or frames before consent; neutral title and unknown date",
  );
  await page.locator(".media-type-filter select").selectOption("videos");
  assert.equal(
    await page.locator(".social-grid > .social-card").count(),
    ig.filter((i) => i.artistId === "twice" && i.contentType !== "post").length,
  );
  await page.locator(".media-search input").fill("no-match-fixture");
  await page.waitForFunction(
    () => document.querySelectorAll(".social-grid > .social-card").length === 0,
  );
  await page.locator(".media-search input").fill("TWICE");
  await card(igVideos[0].id).waitFor();
  checks.push(
    "video-only filter excludes photo posts; artist search and no-match state",
  );
  await play(igVideos[0]);
  await frameCount(1);
  await card(igVideos[0].id)
    .getByText("官方嵌入已加载，播放能力尚未确认", { exact: false })
    .waitFor();
  assert.equal(
    await card(igVideos[0].id)
      .getByRole("button", { name: "在站内播放", exact: true })
      .count(),
    0,
  );
  await play(igVideos[1]);
  await frameCount(1);
  await card(igVideos[1].id).locator("iframe").waitFor();
  assert.equal(await card(igVideos[0].id).locator("iframe").count(), 0);
  await card(igVideos[1].id)
    .getByRole("button", { name: "关闭播放器", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await frameCount(0);
  await play(igVideos[0]);
  await frameCount(1);
  await page.locator(".archive-channel-select select").selectOption("nmixx");
  await frameCount(0);
  checks.push(
    "Instagram controlled embed success; one global player; repeat prevention; close and artist cleanup",
  );
  await goto();
  await card(igVideos[0].id)
    .getByRole("button", { name: /^收藏 / })
    .click();
  await goto("tiktok");
  await card(ttVideos[0].id).waitFor();
  await card(ttVideos[0].id)
    .getByRole("button", { name: /^收藏 / })
    .click();
  await play(ttVideos[0]);
  await frameCount(1);
  const iframe = card(ttVideos[0].id).locator("iframe");
  assert.match(
    await iframe.getAttribute("src"),
    /controls=1&description=1&music_info=1&autoplay=0/,
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://www.tiktok.com",
        source: window,
        data: { "x-tiktok-player": true, type: "onPlayerReady" },
      }),
    ),
  );
  assert.ok((await card(ttVideos[0].id).innerText()).includes("正在加载"));
  const frame = await (await iframe.elementHandle()).contentFrame();
  await frame.getByRole("button", { name: "Ready", exact: true }).click();
  await card(ttVideos[0].id)
    .getByText("播放器由原平台提供", { exact: false })
    .waitFor();
  await frame.getByRole("button", { name: "Error", exact: true }).click();
  await card(ttVideos[0].id)
    .getByText("站内播放暂不可用，原视频可能仍可访问。", { exact: true })
    .waitFor();
  assert.ok(
    await card(ttVideos[0].id)
      .getByRole("link", { name: "打开原始内容", exact: false })
      .isVisible(),
  );
  for (const width of [375, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px overflow`,
    );
    const rect = await iframe.boundingBox();
    assert.ok(Math.abs(rect.height / rect.width - 16 / 9) < 0.02);
  }
  checks.push(
    "TikTok controlled ready/error and forged sender rejection; source fallback; 9:16 and 375/390/412px",
  );
  await page
    .getByRole("button", { name: "Instagram Reels / 帖子", exact: true })
    .click();
  await frameCount(0);
  await page.goto(`${site}#/archive`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-content-id]");
  await page.reload({ waitUntil: "networkidle" });
  await card(ttVideos[0].id).waitFor();
  await card(igVideos[0].id).waitFor();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("seoul-os-archive-v1")),
  );
  for (const id of ["yt-jcmVRR_BnZU", igVideos[0].id, ttVideos[0].id])
    assert.ok(saved.some((s) => s.id === id));
  checks.push(
    "Instagram and TikTok bookmarks survive refresh and render in Archive alongside original YouTube ID",
  );
  await page.goto(site, { waitUntil: "networkidle" });
  await page.waitForSelector("#daily-feed .feed-card");
  assert.equal(await page.locator("#daily-feed .feed-card").count(), 50);
  const yt = page.locator("#daily-feed .feed-card").first();
  await yt.getByRole("button", { name: /收藏/ }).click();
  assert.ok(
    (
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("seoul-os-archive-v1")),
      )
    ).some((s) => s.id.startsWith("yt-")),
  );
  checks.push(
    "original Discover shows 50 YouTube cards and retains bookmark controls",
  );
  await page.locator(".feed-filters select").first().selectOption("itzy");
  await page.waitForFunction(
    () =>
      document.querySelector("#daily-feed .feed-meta a")?.textContent ===
      "ITZY",
  );
  const youtube = JSON.parse(await readFile("data/youtube/itzy.json", "utf8"));
  const youtubeLinks = await page
    .locator("#daily-feed .feed-image-link")
    .evaluateAll((es) => es.map((a) => a.href));
  assert.equal(youtubeLinks.length, 50);
  assert.ok(
    youtubeLinks.every((url) =>
      youtube.items.some(
        (i) => url === `https://www.youtube.com/watch?v=${i.source.videoId}`,
      ),
    ),
  );
  await page.locator(".feed-search input").fill("no-match-playback-regression");
  await page.waitForFunction(
    () => !document.querySelector("#daily-feed .feed-card"),
  );
  await page.locator(".feed-search input").fill("");
  await page.waitForSelector("#daily-feed .feed-card");
  checks.push(
    "YouTube artist switch, search and canonical original playback links remain intact",
  );
  const itzy = ig.filter(
    (i) => i.artistId === "itzy" && i.contentType === "reels",
  );
  const stateFixture = structuredClone(ig);
  for (const item of stateFixture.filter((i) =>
    itzy.some((t) => t.id === i.id),
  )) {
    if (item.id === itzy[1].id) {
      item.sourceAvailability = "unavailable";
      item.embedAvailability = "untested";
    }
    if (item.id === itzy[2].id) {
      item.availabilityStatus = "unknown";
      delete item.sourceAvailability;
      delete item.embedAvailability;
    }
  }
  await page.route("**/data/social/instagram/items.json", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        platform: "instagram",
        items: stateFixture,
      }),
    }),
  );
  await goto("instagram", "itzy");
  assert.equal(await page.locator("iframe").count(), 0);
  await card(itzy[1].id)
    .getByText("原始内容已确认不可访问", { exact: false })
    .waitFor();
  assert.equal(
    await card(itzy[1].id)
      .getByRole("button", { name: "在站内播放", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await card(itzy[2].id)
      .getByRole("button", { name: "在站内播放", exact: true })
      .count(),
    1,
  );
  // A previously restricted manual record must permit an explicit fresh attempt.
  const target = card(itzy[0].id);
  await target
    .getByRole("button", { name: "在站内播放", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await frameCount(1);
  await target
    .getByText("站内播放暂不可用，原视频可能仍可访问。", { exact: true })
    .waitFor();
  for (let n = 0; n < 2; n++) {
    await target
      .getByRole("button", { name: "重试播放器", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await frameCount(1);
  }
  for (const width of [375, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  for (const name of ["打开原始内容", "官方账号"])
    assert.ok(
      await target.getByRole("link", { name, exact: false }).last().isVisible(),
    );
  await target.locator("summary").click();
  assert.ok(
    await target
      .getByRole("link", { name: "查看核验依据", exact: true })
      .isVisible(),
  );
  await play(itzy[2]);
  await frameCount(1);
  await card(itzy[2].id)
    .getByText("官方嵌入已加载，播放能力尚未确认", { exact: false })
    .waitFor();
  checks.push(
    "ITZY restricted embed can be attempted/retried; source unavailable blocked; unknown legacy accepted; duplicate clicks, mobile widths, evidence links",
  );
  await page.unroute("**/data/social/instagram/items.json");
  await page.unroute("https://www.instagram.com/embed.js");
  let sdkFailed = true;
  await page.route("https://www.instagram.com/embed.js", (r) =>
    r.fulfill(
      sdkFailed
        ? { status: 503, body: "unavailable" }
        : { contentType: "text/javascript", body: igScript },
    ),
  );
  await goto();
  await page.reload({ waitUntil: "networkidle" });
  await play(igVideos[0]);
  await card(igVideos[0].id)
    .getByText("站内播放暂不可用，原视频可能仍可访问。", { exact: true })
    .waitFor();
  assert.ok(
    await card(igVideos[0].id)
      .getByRole("link", { name: "打开原始内容", exact: false })
      .last()
      .isVisible(),
  );
  checks.push("Instagram script HTTP 503 keeps usable card and original link");
  sdkFailed = false;
  await card(igVideos[0].id)
    .getByRole("button", { name: "重试播放器", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await frameCount(1);
  await card(igVideos[0].id)
    .getByText("官方嵌入已加载，播放能力尚未确认", { exact: false })
    .waitFor();
  checks.push(
    "failed Instagram SDK retries successfully without duplicate frames; shell success is never labelled video playback",
  );
  await page.route("**/data/social/tiktok/items.json", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await goto("tiktok");
  await page.getByText("内容暂时无法读取", { exact: false }).waitFor();
  await goto("tiktok", "day6");
  await page.getByText("内容暂时无法读取", { exact: false }).waitFor();
  checks.push("manifest HTTP 503 is isolated to social panel with retry");
  assert.deepEqual(errors, []);
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/social-ui.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: "controlled engineering tests; NOT real playback",
        checks,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ passed: true, checks }));
} catch (e) {
  console.error(
    JSON.stringify({
      errors,
      cards: await page
        .locator(".social-grid > .social-card")
        .evaluateAll((es) =>
          es.map((e) => ({
            id: e.dataset.contentId,
            frames: e.querySelectorAll("iframe").length,
            blocks: e.querySelectorAll("blockquote").length,
            buttons: [...e.querySelectorAll("button")].map(
              (b) => b.textContent,
            ),
          })),
        ),
    }),
  );
  throw e;
} finally {
  await browser.close();
}
