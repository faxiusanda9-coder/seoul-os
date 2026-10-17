// Explicit, bounded acceptance run against the real site and official players.
// Does not discover/import media or modify manifests; never substitutes mocks.
import { chromium } from "playwright-core";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function launchBrowser() {
  let executablePath = process.env.BROWSER_EXECUTABLE;
  if (!executablePath && process.platform === "win32") {
    const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
    try {
      await access(edge);
      executablePath = edge;
    } catch {}
  }
  return chromium.launch(
    executablePath
      ? { executablePath, headless: true }
      : { channel: "chrome", headless: true },
  );
}
export const site = process.env.BASE_URL ?? "http://localhost:5174/seoul-os/";
export async function verifyPlayback() {
  const get = (name) =>
    process.argv
      .find((v) => v.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const platform = get("platform") ?? "tiktok";
  if (!["instagram", "tiktok"].includes(platform))
    throw Error("Use --platform=instagram or tiktok");
  const all = JSON.parse(
    await readFile(`data/social/${platform}/items.json`, "utf8"),
  ).items;
  const items = all
    .filter(
      (i) =>
        i.contentType !== "post" &&
        i.availabilityStatus === "available" &&
        (!get("artist") || i.artistId === get("artist")) &&
        (!get("id") || i.id === get("id")),
    )
    .slice(0, Number(get("limit") ?? all.length));
  const browser = await launchBrowser(),
    page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      locale: "en-US",
    });
  const results = [],
    output = resolve("test-results");
  await mkdir(output, { recursive: true });
  try {
    for (const item of items) {
      const result = {
        id: item.id,
        artistId: item.artistId,
        sourceUrl: item.sourceUrl,
        checkedAt: new Date().toISOString(),
        platform,
        environment:
          "real official iframe in local SEOUL.OS; Edge/Chrome headless; 390px; no mocks",
      };
      try {
        await page.goto(
          `${site}#/media?artist=${item.artistId}&platform=${platform}`,
          { waitUntil: "domcontentloaded" },
        );
        const card = page.locator(`[data-content-id="${item.id}"]`);
        await card
          .getByRole("button", { name: "在站内播放", exact: true })
          .click();
        let frame;
        for (let n = 0; n < 60; n++) {
          frame = page
            .frames()
            .find((f) =>
              platform === "tiktok"
                ? f.url().startsWith(item.embedUrl)
                : f.url().startsWith(item.embedUrl),
            );
          if (frame) break;
          await page.waitForTimeout(200);
        }
        result.frameCreated = !!frame;
        if (!frame) throw Error("Official iframe not created");
        const control =
          platform === "tiktok"
            ? frame.getByRole("button", { name: "Play video", exact: true })
            : frame
                .locator(
                  '[aria-label="Control"],[aria-label="控件"],.EmbeddedMediaPlayButton',
                )
                .first();
        await control.click({ timeout: 12000 });
        await frame.waitForFunction(
          () =>
            [...document.querySelectorAll("video")].some(
              (v) => v.currentTime > 0.5 && !v.paused && v.readyState >= 2,
            ),
          {},
          { timeout: 12000 },
        );
        result.videoState = await frame
          .locator("video")
          .evaluateAll((es) =>
            es.map((v) => ({
              currentTime: v.currentTime,
              readyState: v.readyState,
              paused: v.paused,
              errorCode: v.error?.code ?? null,
            })),
          );
        result.playbackConfirmed = result.videoState.some(
          (v) => v.currentTime > 0.5 && !v.paused && v.readyState >= 2,
        );
        result.noHorizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(output, `${item.id}.png`) });
        await card
          .getByRole("button", { name: "关闭播放器", exact: true })
          .click();
        result.closedCleanly =
          (await page.locator(".official-embed iframe").count()) === 0;
      } catch (e) {
        result.playbackConfirmed = false;
        result.error = e.message.slice(0, 300);
      }
      results.push(result);
      await writeFile(
        resolve(output, `${platform}-${get("id") ?? "playback"}.json`),
        JSON.stringify(
          { checkedAt: new Date().toISOString(), site, results },
          null,
          2,
        ) + "\n",
      );
      console.log(
        JSON.stringify({
          id: result.id,
          played: result.playbackConfirmed,
          overflow: result.noHorizontalOverflow === false,
          error: result.error,
        }),
      );
    }
  } finally {
    await browser.close();
  }
  if (
    !results.length ||
    results.some(
      (r) =>
        !r.playbackConfirmed || !r.noHorizontalOverflow || !r.closedCleanly,
    )
  )
    process.exitCode = 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await verifyPlayback();
