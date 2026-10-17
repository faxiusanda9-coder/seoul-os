// Explicit real-display acceptance of reviewed Instagram photo/carousel posts.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, site } from "./verify-social-playback.mjs";
const targetId = process.argv.find((a) => a.startsWith("--id="))?.slice(5);
const output = `test-results/instagram-posts${targetId ? "-" + targetId : ""}.json`;
const items = JSON.parse(
  await readFile("data/social/instagram/items.json", "utf8"),
).items.filter(
  (i) => i.contentType === "post" && (!targetId || i.id === targetId),
);
const browser = await launchBrowser(),
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: "en-US",
    reducedMotion: "reduce",
  }),
  results = [];
await mkdir("test-results", { recursive: true });
try {
  for (const item of items) {
    const r = {
      id: item.id,
      artistId: item.artistId,
      sourceUrl: item.sourceUrl,
      checkedAt: new Date().toISOString(),
      mode: "real official embed in local SEOUL.OS; photo display, no video playback assertion",
    };
    try {
      await page.goto(
        `${site}#/media?artist=${item.artistId}&platform=instagram`,
        { waitUntil: "domcontentloaded" },
      );
      const card = page.locator(`[data-content-id="${item.id}"]`);
      await card
        .getByRole("button", { name: "在站内查看", exact: true })
        .click();
      let frame;
      for (let n = 0; n < 60; n++) {
        frame = page.frames().find((f) => f.url().startsWith(item.embedUrl));
        if (frame) break;
        await page.waitForTimeout(200);
      }
      if (!frame) throw Error("Official post frame not created");
      await frame.waitForFunction(
        () =>
          [...document.querySelectorAll("img")].some(
            (i) => i.naturalWidth > 0 && i.getBoundingClientRect().width >= 200,
          ),
        {},
        { timeout: 10000 },
      );
      r.images = await frame.locator("img").evaluateAll((es) =>
        es
          .filter(
            (i) => i.naturalWidth > 0 && i.getBoundingClientRect().width >= 200,
          )
          .map((i) => ({
            naturalWidth: i.naturalWidth,
            displayWidth: i.getBoundingClientRect().width,
          })),
      );
      r.displayConfirmed = r.images.length > 0;
      r.noHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      if (item.artistId === "yaochen" || item.artistId === "twice") {
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/${item.id}-post.png` });
      }
      await card
        .getByRole("button", { name: "关闭播放器", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => document.querySelectorAll(".official-embed iframe").length === 0,
      );
      r.closedCleanly = true;
    } catch (e) {
      if (!r.displayConfirmed) r.displayConfirmed = false;
      r.error = e.message.slice(0, 220);
    }
    results.push(r);
    await writeFile(output, JSON.stringify({ results }, null, 2) + "\n");
    console.log(
      JSON.stringify({
        id: r.id,
        displayed: r.displayConfirmed,
        error: r.error,
      }),
    );
  }
} finally {
  await browser.close();
}
if (results.some((r) => !r.displayConfirmed || !r.noHorizontalOverflow))
  process.exitCode = 1;
