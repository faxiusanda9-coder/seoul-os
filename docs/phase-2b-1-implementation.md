# Phase 2B-1：TWICE 单频道接入记录

日期：2026-10-14。范围仅限 TWICE 官方 YouTube 频道。**截至本记录生成时，仓库内没有真实 API 视频数据；`data/youtube/twice.json` 是空占位文件。**本地未配置 `YOUTUBE_API_KEY`，不能将模拟测试视为成功调用 YouTube API。

## 数据路径

```text
YouTube Data API v3
  channels.list(TWICE channel ID)
  → uploads playlist ID 校验
  → playlistItems.list(最近 50 条)
  → videos.list(公开状态、所属频道、发布时间、元数据)
  → scripts/youtube-sync.mjs 校验、去重、增量合并
  → data/youtube/twice.json（提交到 main）
  → scripts/stage-public-data.mjs
  → dist/data/youtube/twice.json
  → GitHub Pages /seoul-os/data/youtube/twice.json
  → ContentProvider → Daily JYP Feed / Search / Artist Detail / Archive
```

频道 ID `UCzgxx_DM2Dcb9Y1spb9mUJA` 和上传列表 ID `UUzgxx_DM2Dcb9Y1spb9mUJA` 来自 [Phase 2A 证据表](phase-2-data-plan.md)。运行时 `channels.list` 必须返回相同的频道与上传列表 ID，否则拒绝覆盖旧数据。`channels.list` 已提供上传列表 ID，因此不另调用 `playlists.list`。发布时只存视频 ID、频道 ID、艺人 ID、标题、最多 280 字描述、发布时间、缩略图 URL、视频 URL、内容类型和抓取时间；不下载视频或缩略图文件。

## 稳定性与边界

- 每次只读取最近 50 个上传 ID，不抓取整个历史库；`videos.list` 一批最多 50 条。ID 去重，校验 `snippet.channelId` 和公开状态后写入。
- 已有记录在 30 天内保留，元数据未变化时复用旧 `fetchedAt`，避免每次运行都生成 commit。约 15 天后会刷新记录验证时间；只有 JSON 实际变化才提交。
- 所有 API 调用和数据验证成功后才原子替换 JSON。API 错误、无密钥、频道 ID 不匹配、空结果均保留上次成功文件。浏览器端在文件缺失、无有效条目或快照超过 30 天时显示精选/演示回退数据。
- 收藏沿用 `seoul-os-archive-v1`，视频 ID 仍为 `yt-<videoId>`。视频退出最近列表后，Archive 保留 YouTube 入口和取消收藏按钮；标题等元数据不会在浏览器中另行长期缓存。
- 内容类型由标题的保守关键词规则归类；`other` 不应理解为官方发布类型。上传视频的时间也不会转换为日历事件日期。
- 初次真实同步前，`Official YouTube Source` 不会出现在页面，TWICE 的旧精选样本继续作为回退。

## 配额与运行

单次正常同步调用 `channels.list`、`playlistItems.list`、`videos.list` 各 1 次，按官方当前每次 1 unit 计，约 **3 units/次，6 units/日**。这是估计值，不包含请求错误、将来增加分页或其他频道。计划使用 GitHub Actions 的 `0 0,12 * * *` UTC，即北京时间 08:00 和 20:00；GitHub 定时任务可能延迟。工作流只在 JSON 改变时提交，并显式调用 Pages 部署工作流，因为 `GITHUB_TOKEN` 发起的 push 不会再触发普通 push workflow。

设置方法：在仓库 **Settings → Secrets and variables → Actions** 新增 `YOUTUBE_API_KEY`，并在 **Settings → Actions → General** 将 Workflow permissions 设为读写。随后手动运行 `Sync TWICE YouTube data`，检查 `data/youtube/twice.json` 有真实条目且 Pages 上相同路径返回 JSON。密钥不进入前端环境变量、仓库文件或浏览器构建包。

## 2026-10-14 检查结果

| 检查                             | 结果                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:sync`              | 4/4 通过：有效响应、缺密钥、API 500 保留旧文件、重复执行无重复/无改动。响应为测试夹具，并非真实 YouTube 请求。                             |
| `npm run check`、`npm run build` | 通过；`dist/data/youtube/twice.json` 存在，构建包无 `YOUTUBE_API_KEY` 字样。                                                               |
| Playwright 模拟真实 JSON         | 通过：TWICE 视频卡、远程缩略图、YouTube 链接、收藏、刷新持久化、JSON 404 回退和 Archive 保留链接。缩略图网络响应在测试中使用本地测试图片。 |
| Playwright 现有回归              | 360、375、390、412、768、1440 像素视口，主要路由、收藏、关注、筛选、搜索、时间轴和子路由刷新通过；未在真实手机设备上运行。                 |
| GitHub Pages 子路径              | 本地生产预览的 `/seoul-os/data/youtube/twice.json` 返回 200；真正线上 JSON 和 Actions 需部署后复核。                                       |
| 真实 YouTube API 成功获取        | **未测试**。当前没有 API Key，GitHub Secret 尚需配置。                                                                                     |

## 下一步

1. 配置 GitHub Secret 和 Actions 写入权限，手动运行同步；核对运行日志、频道校验、真实视频 JSON、缩略图和 Pages URL。
2. 观察至少两个定时周期：确认无变化时不提交、有新增视频时能提交并自动部署、失败时旧数据可用。
3. 再评估更多频道的内容政策、所属关系、增量分页策略和配额上限；不在本阶段直接扩展。

官方技术依据：[Channels.list](https://developers.google.com/youtube/v3/docs/channels/list)、[PlaylistItems.list](https://developers.google.com/youtube/v3/docs/playlistItems/list)、[Videos.list](https://developers.google.com/youtube/v3/docs/videos/list)、[配额表](https://developers.google.com/youtube/v3/determine_quota_cost)、[GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[GITHUB_TOKEN 触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)。
