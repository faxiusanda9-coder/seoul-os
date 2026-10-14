# SEOUL.OS Phase 2B-1.1 最终验收报告

验收时间：2026-10-14（北京时间）。范围仅限 TWICE 官方 YouTube 频道；未扩展其他艺人、数据库或 UI 功能。

## 结论：PASS

**第一次真实数据链路与部署成功。** YouTube Data API → GitHub Actions → 仓库静态 JSON → GitHub Pages → SEOUL.OS Daily JYP Feed 已用真实响应走通。第二次手动同步成功且数据无变化，没有产生重复提交或无意义部署。**定时运行的长期稳定性尚不能由两次手动运行证明**；配置密钥之前的一次定时运行因缺少 Secret 失败，需继续观察后续定时周期。

## 1. 凭据、来源与实际数据

| 项目 | 实际结果与证据 |
| --- | --- |
| GitHub Actions Secret | `YOUTUBE_API_KEY` 已在 `faxiusanda9-coder/seoul-os` 的仓库 Actions Secrets 中创建，并通过 GitHub API 的 Secret 元数据接口确认存在；没有读取或打印 Secret 明文。密钥不在源码、JSON 或前端构建产物中。 |
| 官方频道身份 | [JYP 官方艺人目录](https://www.jype.com/ko/Artist) 的 TWICE YouTube 入口是 Phase 2A 的身份依据；本次真实 `channels.list` 再确认 `UCzgxx_DM2Dcb9Y1spb9mUJA` 返回上传列表 `UUzgxx_DM2Dcb9Y1spb9mUJA`。同步脚本不匹配即拒绝写入。 |
| 真实 API | [首次手动运行](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38565089712) 的 `Sync verified TWICE uploads` 步骤成功，日志显示 `TWICE sync: 50 videos; data updated`。按脚本调用顺序执行 `channels.list`、`playlistItems.list`、`videos.list`；视频必须属于核对过的频道且为公开状态。 |
| 实际视频数 | **50 条**，`videoId` 唯一数也是 **50**；[仓库数据](https://github.com/faxiusanda9-coder/seoul-os/blob/main/data/youtube/twice.json) 通过 `parseContentSnapshot` 校验。其他艺人的 Feed 条目仍为已有精选或演示数据，不能算作实时 API 内容。 |
| 最新条目 | 原始标题：**TWICE Special Vinyl ＜THIS IS FOR＞  WORLD TOUR FINALE in SEOUL - LIVE : D-2**；video ID：`U7cZw1XoNtw`；`publishedAt`：`2026-10-14T09:00:28.000Z`（北京时间 17:00:28）；[YouTube 原链接](https://www.youtube.com/watch?v=U7cZw1XoNtw)。本次快照 `fetchedAt`：`2026-10-14T12:36:39.291Z`。 |
| 来源验证字段 | 每条实际数据的 `source.verification` 为 `official-channel`，与固定的 TWICE 频道 ID、上传列表 ID、视频 ID 一起通过 schema 校验。内容类型由标题关键词推断，**不是 YouTube 官方分类**。 |

只保存视频公开元数据和 YouTube 缩略图 URL；没有下载、复制或重新托管视频。首条视频的 `i.ytimg.com` 缩略图经 HTTP HEAD 返回 200 `image/jpeg`，线上手机与桌面浏览器均实际加载，图片自然宽度为 320 px。

## 2. Actions 与 Pages 运行结果

| 运行 | 结果 |
| --- | --- |
| [配置前定时运行 38564514283](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38564514283) | **失败**。`npm ci` 成功，同步步骤明确报 `YOUTUBE_API_KEY is missing; existing data was not changed`；没有调用 YouTube API、提交数据或部署。发生在 Secret 配置前，不能算作真实同步成功。GitHub 定时触发比目标 UTC 12:00 晚约 32 分钟。 |
| [代码部署 38564692920](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38564692920) | **成功**。类型检查、Vite 构建、Pages artifact 上传和部署均成功；提交 `f264a6d`。 |
| [首次真实同步 38565089712](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38565089712) | **成功**。同步得到 50 条，校验和构建成功，Actions 将 JSON 提交为 `49fe9fc`。同一运行中的可复用 Pages `build` 与 `deploy` 两个 job 均成功；没有依赖 `GITHUB_TOKEN` 推送再次触发工作流。 |
| [第二次真实同步 38565504516](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38565504516) | **成功且无变化**。日志为 `TWICE sync: 50 videos; no change`；提交步骤和 Pages 部署 job 均跳过，远程 `main` 仍为 `49fe9fc`。 |

线上地址：[SEOUL.OS](https://faxiusanda9-coder.github.io/seoul-os/)；[公开 JSON](https://faxiusanda9-coder.github.io/seoul-os/data/youtube/twice.json)。Pages JSON 实际返回 50 条、首条 ID `U7cZw1XoNtw`。Vite `base` 为 `/seoul-os/`，前端请求通过 `import.meta.env.BASE_URL` 构造；路由继续使用 `HashRouter`，子页面刷新不依赖服务端重写。

## 3. 前端与自动化验收

- 线上 Playwright + Edge 在 **375×812 手机模拟**与 **1440×900 桌面模拟**环境中直接读取 Pages JSON；两种视口都显示 50 条真实 TWICE 内容，首条原始标题、`time[datetime]`、YouTube 视频链接、真实缩略图和“TWICE 官方 YouTube”来源标识正确。收藏后进入 Archive、刷新后仍保留，未发现页面 JavaScript 运行时错误。
- 本地 Playwright 回归覆盖 **360×800、375×812、390×844、412×915、768×1024、1440×900**：主要路由、子路由刷新、收藏和取消收藏、关注和取消关注、搜索、组合筛选、排序、日历和年份切换通过，未见异常横向溢出或页面错误。中英文布局另测 12 个视口组合通过。这些是浏览器模拟，**不是用户实体手机网络测试**。
- 本地注入的**测试夹具**验证了 JSON 404 回退、缩略图回退、动态视频收藏后 Archive 保留入口、语言切换。夹具结果与上述真实 API / 线上结果分别记录，没有把模拟响应算作官方视频。
- `npm run check`、`npm run build`、`npm run test:sync`（6/6）、`npm run test:i18n`（1/1）均通过；`dist/data/youtube/twice.json` 通过 schema 校验。缺密钥执行实际同步命令时退出码为 1，原 JSON SHA-256 不变。模拟 API 500 也保留旧快照；重复响应去重；私密视频在下一次成功同步时移除。

## 4. 配额、刷新与仍需观察的问题

这两次成功的手动同步各调用 1 次 `channels.list`、1 次 `playlistItems.list`、1 次 `videos.list`。按 [YouTube 官方配额表](https://developers.google.com/youtube/v3/determine_quota_cost)各 1 unit 估算，共 **6 units**；配置前失败的定时运行在本地缺密钥检查即退出，估算 **0 units**。这是**依据请求次数的估算**，不是 Google Cloud 控制台实测用量。正常每日 08:00 / 20:00（北京时间）两次同步预计 **6 units/日**，异常重试与额外手动运行另计。

同步每次只检查最新 50 个上传项，不抓取整个历史库；元数据约 15 天强制刷新，同步失败保留最近成功快照。前端对超过 30 天的快照停止展示实时数据，回退到明确标识的精选/演示内容。成功刷新时删除本次窗口中已私密、删除或退出最新 50 条的元数据。[YouTube 开发者政策](https://developers.google.com/youtube/terms/developer-policies)要求非授权 API 数据在 30 天内刷新或删除，并尽可能反映当前状态。**尚存边界**：若连续失败超过 30 天，前端虽隐藏过期内容，旧静态 JSON 和 Git 历史仍可能可访问；需要在后续维护中设计到期清理/不长期保留的发布策略，并复核政策适用性。

密钥已在本次聊天中出现；虽然未写入仓库或日志，仍建议由有 Google Cloud 权限的账户**轮换该密钥，并更新同名 GitHub Secret**。本环境没有 Google Cloud 授权，不能代替账户所有者轮换或核对 Cloud 配额。也尚未经过配置密钥后的两个实际定时周期，不能声称长期定时稳定性已验证。

## 5. 是否进入 Phase 2B-2

**数据链路的首次验收通过，但暂不自动开始 Phase 2B-2。**先观察至少两个后续定时周期、轮换已暴露的密钥，并处理长期失败时的过期元数据发布策略。下一阶段若扩展到其他艺人，应逐个复核 JYP 官方入口、频道与上传列表归属，继续区分真实官方数据和演示内容。
