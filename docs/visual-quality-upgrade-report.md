# SEOUL.OS 高清视觉素材升级验收报告

日期：2026-10-15。范围：现有多频道 YouTube 视频缩略图与艺人目录／详情封面。未修改视频文件、收藏 ID、频道映射或主视觉色彩。

## 诊断与实际原因

- 升级前，同步器优先取 `medium` 缩略图并只保存一个 URL；14 个频道的 700 条快照中，699 条指向 `mqdefault.jpg`，另 1 条指向 `mqdefault_live.jpg`，即约 320×180。`videos.list` 实际还返回其他等级，但同步器丢弃了它们。
- 艺人目录曾将 320×180 的本地视频截图用作大幅艺人封面。1440px 桌面实测卡片图宽 425 CSS px，源图宽仅 320px；照片细节不足是模糊的主要原因。
- 视频列表的 `object-fit: contain` 没有拉伸画面；问题在于手机 DPR 3 时，124×70 CSS px 的显示区域需要更多物理像素。原先固定的 320×180 源图不能充分覆盖该需求。
- 升级前后 Playwright 均未发现页面横向溢出或运行时异常。懒加载图片首次出现时可短暂显示设计型占位；已预留图片区域，避免明显布局跳动。

## 实施文件

- `scripts/youtube-sync.mjs`、`data/schemas/content.schema.ts`：从已有 `videos.list` 结果保存实际存在的缩略图 URL、等级、宽高；快照升为 schema v2；继续读取旧版 v1；不增加 API 请求。
- `src/types.ts`、`src/store/ContentContext.tsx`、`src/utils/thumbnails.ts`、`src/components/FeedThumbnail.tsx`、`src/pages/ArchivePage.tsx`：传递缩略图等级；通过 `srcset` / `sizes` 按展示尺寸和 DPR 选择；请求失败时重试其他已知 URL，最后回退文字封面；维持原视频链接和收藏 ID。
- `src/data/artistVisuals.ts`、`src/components/ArtistVisual.tsx`、`src/components/ArtistPhotoCredit.tsx`、`src/components/ArtistCard.tsx`、`src/pages/ArtistDetailPage.tsx`、`src/styles.css`、`src/locales/{zh-CN,en}.json`：艺人视觉与视频封面分离；四组使用高分辨率全员照片、来源署名和修改说明，其余保持现有文字设计封面。
- `public/artist-images/`：四张照片各有 960px 卡片版、1920px 详情版。仅缩放与 JPEG 压缩，不裁切、不锐化、不 AI 放大。
- `tests/youtube-sync.test.mjs`：v1 兼容、真实等级保留与伪造等级拒绝等测试。

## 素材来源与使用记录

挑选原则为全员可辨、视觉表现力、足够大的原始尺寸和可核对的许可；没有“最热门”访问量排名数据，因此不声称按热度排序。以下是艺人视觉照片，**不是** YouTube API 视频缩略图。页面内展示作者、原页面、许可链接及缩放压缩提示。

| 艺人 | 原件尺寸 | 页面交付尺寸 | 作者／许可 | 来源 |
| --- | ---: | ---: | --- | --- |
| TWICE | 4364×2455 | 960×540 / 1920×1080 | David Lee，CC BY 2.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:TWICE_in_Las_Vegas_01.jpg) |
| Stray Kids | 3750×1860 | 960×476 / 1920×952 | K-POPIT，CC BY 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Stray_Kids_at_the_40th_Golden_Disc_Awards,_January_10,_2026_(1).png) |
| ITZY | 3479×1957 | 960×540 / 1920×1080 | TV10，CC BY 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:251110_ITZY.png) |
| NMIXX | 2410×1928 | 960×768 / 1920×1536 | David Lee，CC BY 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:NMIXX_in_Oakland.jpg) |

交付图保持原始纵横比。Stray Kids 原件超过 1080px 高；横向压到 1920px 后高度为 952px，故交付文件本身不称作“1080p 视频”或“蓝光”。网站按实际展示尺寸加载卡片版或详情版。照片的 CC 许可与视频 API 使用是两套独立来源记录。

仍采用文字封面的 10 位艺人：DAY6、Xdinary Heroes、KickFlip、NiziU、NEXZ、YAOCHEN、BOY STORY、GIRLSET、2PM、J.Y. Park。原因是本轮仅找到并核实四张符合质量与许可条件的团体图；不以低清或未核实素材填满目录。具体艺人清单以 `src/data/artists.ts` 和 `src/data/artistVisuals.ts` 为准。

## YouTube 缩略图策略

[官方视频资源文档](https://developers.google.com/youtube/v3/docs/videos)与[缩略图文档](https://developers.google.com/youtube/v3/docs/thumbnails)说明可用等级随视频而异。2026-10-15 的真实同步保存了 14×50＝700 条视频的实际返回等级：`default` 700、`medium` 700、`high` 700、`standard` 700、`maxres` 693、`fhd` 54、`qhd` 5、`uhd` 7。不能由缩略图等级推断视频播放分辨率。

同宽高比候选进入 `srcset`，浏览器按显示宽度与 DPR 选图；不同画幅继续 `contain`，保持原始画面。旧 JSON 没有 `thumbnails` 时仍用旧 `thumbnail`。真实同步已将 `data/youtube/*.json` 中 14 个频道快照更新为 schema v2，不构建跨频道合并 JSON。

## 验证结果

- GitHub Actions 真实同步：[run 38601750206](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38601750206) 成功，提交 `d50ae75`；700 条快照含实际宽高和 URL。这是真实 API 同步，不是模拟测试。
- Playwright（Edge）在 375×812、DPR 3 抽查 10 条不同艺人／日期／产品分类的视频：TWICE `U7cZw1XoNtw`、`llLK9F-4RVw`、`bp4InMLGJl8`，Stray Kids `55SGehW68yU`，ITZY `Vr3VWJp6JGg`，NMIXX `mAdhOqkmPjY`，DAY6 `PRGmm4kvlZw`，KickFlip `-1bkUKmoG5g`，NEXZ `UCLKH_NUoEU`，Xdinary Heroes `CFVNuXA8eaU`。10/10 加载实际 `maxres` URL；图片为 `contain`。这里的“分类”是 SEOUL.OS 标题规则，非 YouTube 官方分类。
- 拦截 `maxres` 请求后，首条视频自动回退 `hqdefault.jpg`；外链仍指向相同 `watch?v=` ID。收藏一条 TWICE 视频后刷新 Archive 可见，稳定 `yt-<videoId>` 未改变。浏览器 `pageerror` 为 0。
- 375px 和 1440px 截图及 DOM 测量中，文档宽度分别为 375px、1440px，没有横向溢出；四张照片卡片不变形。桌面卡片使用 960px 图，手机 DPR 3 使用 960px 图，详情可用 1920px 图。`naturalWidth` 在 `srcset` 场景可能报告按密度换算后的值，原件和交付尺寸以文件元数据为准。
- `npm run check`、`npm run build`、`npm run test:sync`（9/9）、`npm run test:i18n`（1/1）通过。构建仍提示主 JS 包大于 500 kB，这是现有打包提示，本轮未新增大型 JS 依赖。

## 前后对比截图

| 视口 | 升级前 | 升级后 |
| --- | --- | --- |
| 375px 艺人目录 | [PNG](screenshots/before-375-artists.png) | [PNG](screenshots/final-375-artists.png) |
| 1440px 艺人目录 | [PNG](screenshots/before-1440-artists.png) | [PNG](screenshots/final-1440-artists.png) |
| 375px 视频动态 | [PNG](screenshots/before-375-feed.png) | [PNG](screenshots/final-375-feed.png) |

## 性能与后续素材替换

四张卡片版合计约 424 KiB；四张详情版合计约 1.54 MiB，按需加载。首屏列表不一律请求 `maxres`；本地照片文件由 Pages 托管，不调用付费图片服务。未做跨地区网络测速，因此没有虚构加载时间提升。相比先前的 320px 大图，本轮增加了图片字节以换取清晰度；请求量依赖浏览器懒加载和用户浏览位置。

替换／增加用户提供的高清团体图：将合法可用原图制作成保留原画幅的 960px 与约 1920px 两版，置于 `public/artist-images/`；在 `src/data/artistVisuals.ts` 填写 `cardImage`、`heroImage`、`imageSource`、`imageCredit`、`imageLicenseName`、`imageLicenseUrl` 与 `imageLicenseStatus: "licensed"`；构建后检查 375px 和 1440px 画面及页面上的署名链接。未提供可核对授权的艺人继续显示现有排版封面。

## 部署状态

视觉代码提交 `2eb2c8a` 后，[Pages 工作流 run 38604343279](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38604343279) 的 build 和 deploy 两个 Job 均成功。线上入口：[SEOUL.OS](https://faxiusanda9-coder.github.io/seoul-os/)。

实际 HTTP 检查：`/seoul-os/artist-images/twice-960.jpg`、`/seoul-os/artist-images/stray-kids-1920.jpg`、`/seoul-os/data/youtube/twice.json` 全部返回 200；线上 TWICE JSON 为 schema v2、50 条、首条 `U7cZw1XoNtw` 含 5 档实际缩略图。线上 Playwright 在 375px 和 1440px 加载了艺人照片与 YouTube 视频图，页面宽度恰为视口宽度，`pageerror` 为 0。此处验证的是访问与图片加载，不代表已测遍所有地区网络或所有 700 条视频。
