# SEOUL.OS Phase 2A：真实数据源验证与接入计划

验证日期：2026-10-14（Asia/Shanghai）。本轮只审查现有前端、核对公开来源并设计方案；**没有调用 YouTube Data API、创建密钥、接入实时数据或更改网站的数据流**。下表中的频道 ID 来自 JYP 官网指向的 YouTube 页面，上传列表 ID 已通过相应 YouTube `Uploads from ...` 页面核对；正式 API 同步前还需用 `channels.list(part=contentDetails,snippet)` 再核对一次。

## 1. 第一阶段代码验证

项目仍为 React + TypeScript + Vite，`HashRouter` 处理 GitHub Pages 子路由，Vite `base` 为 `/seoul-os/`，现有 Actions 在 `main` 推送后构建并部署。`src/data/feed.ts` 是人工精选的九条历史官方视频及五条 **DEMO** 条目；页面没有实时 API。收藏与关注共用 `src/store/ArchiveContext.tsx`，保存在当前浏览器的 `localStorage`，并监听同源其他标签页的 `storage` 事件。

| 检查项 | 结果与证据 |
| --- | --- |
| 收藏、取消收藏、Archive 同步 | Playwright 在线站点测试通过：收藏后 Archive 出现一条，取消后归零。 |
| 关注、取消关注、My Space 同步 | Playwright 在线站点测试通过：关注后 My Space 出现艺人，取消后归零。 |
| `localStorage` 持久化与异常数据 | 收藏、关注在刷新后保留；损坏的 JSON 被安全忽略。当前状态只在同一浏览器配置文件内有效。 |
| 艺人/内容类型筛选、搜索、排序 | 联合筛选、空结果、清除筛选、日期排序及独立搜索页测试通过。 |
| GitHub Pages | `https://faxiusanda9-coder.github.io/seoul-os/` 在线测试通过；`/#/artists/twice` 刷新正常，14 张动态图片均从 `/seoul-os/video-thumbnails/` 加载。 |
| 响应式与控制台 | 360×800、375×812、390×844、412×915、768×1024、1440×900 无横向溢出或 JS 控制台错误；这属于浏览器模拟检查，未在用户的实际手机网络上实测。 |
| 静态检查 | `npm run check`、`npm run build` 均通过。 |

当前交互没有发现需在 2A 修改的阻断错误。**接入动态数据前必须处理的结构问题**：`ArchiveContext` 用静态 `feed` ID 集合验证收藏，未来动态视频不在集合中会被丢弃；`ArchivePage` 也只在静态 `feed` 中查找收藏，动态内容会显示不出来。`FeedThumbnail` 当前只为九个已收录 `videoId` 提供本地文件，新视频会回退到文字封面。`publishedAt` 目前允许日期字符串或 `null`，实时视频需要完整 UTC 时间戳。搜索、筛选与归档均直接引用静态 `feed`；应在 2B 通过数据适配层统一读入，但不必现在重构。

## 2. 数据源及证据链

官方身份的判定顺序：

1. [JYP Entertainment 官方艺人目录](https://www.jype.com/ko/Artist) 的艺人行或页头直接链接到 YouTube，确认这是 JYP 对外公布的频道入口。频道**名称本身不作为证明**。
2. 打开该 YouTube 链接，从页面公开的频道元数据（`externalId`/RSS channel ID）取得稳定的 `UC...` ID，而不把易变的 `@handle` 当主键。
3. 打开相应上传列表 URL，确认页面显示 `Uploads from <频道>` 且包含对应 `UU...` 列表 ID。`UU` 前缀不是本轮唯一证据；**列表页面实际可打开并显示匹配频道**才记为已核对。
4. 2B 有 API Key 后，再用 [官方 `channels.list`](https://developers.google.com/youtube/v3/docs/channels/list) 的 `contentDetails.relatedPlaylists.uploads` 与这里的列表 ID 交叉验证。当前尚无 API 响应，故不能声称已完成 API 级验证。

[JYP 官方视频索引](https://www.jype.com/ko/Artist/Video) 可作为具体 M/V 链接和编辑核对来源；它是有分页的网页，不是已确认的稳定数据 API，也不能代表全部艺人动态。YouTube 官方说明频道上传列表由 `channels.list` 的 `contentDetails.relatedPlaylists.uploads` 指向，再用 [`playlistItems.list`](https://developers.google.com/youtube/v3/docs/playlistItems/list) 读取。每条视频的精确发布时间应取 [`videos.list` 的 `snippet.publishedAt`](https://developers.google.com/youtube/v3/docs/videos)，或交叉核对 `playlistItems.contentDetails.videoPublishedAt`；`playlistItems.snippet.publishedAt` 只是加入列表的时间。[字段说明](https://developers.google.com/youtube/v3/docs/playlistItems)

### 艺人 → 官方频道映射

状态列的“网页已核对”表示上述官网链接、频道 ID 与上传列表页面三步均通过；不代表频道之间的 YouTube 内容所有权已确认。JYP 主频道可发布多个艺人的视频，不能把它的全部上传自动归给某个艺人。

| 范围 / 艺人 | JYP 官网指向的频道 | 频道 ID | 上传列表 ID / 证据 | 状态 |
| --- | --- | --- | --- | --- |
| JYP 主频道 | [JYP Entertainment](https://www.youtube.com/jypentertainment) | `UCaO6TYtlC8U5ttz62hTrZgg` | [`UUaO6TYtlC8U5ttz62hTrZgg`](https://www.youtube.com/playlist?list=UUaO6TYtlC8U5ttz62hTrZgg) | 网页已核对 |
| TWICE | [TWICE](https://www.youtube.com/c/twice) | `UCzgxx_DM2Dcb9Y1spb9mUJA` | [`UUzgxx_DM2Dcb9Y1spb9mUJA`](https://www.youtube.com/playlist?list=UUzgxx_DM2Dcb9Y1spb9mUJA) | 网页已核对 |
| Stray Kids | [Stray Kids](https://www.youtube.com/c/StrayKids) | `UC9rMiEjNaCSsebs31MRDCRA` | [`UU9rMiEjNaCSsebs31MRDCRA`](https://www.youtube.com/playlist?list=UU9rMiEjNaCSsebs31MRDCRA) | 网页已核对 |
| ITZY | [ITZY](https://www.youtube.com/c/ITZY) | `UCDhM2k2Cua-JdobAh5moMFg` | [`UUDhM2k2Cua-JdobAh5moMFg`](https://www.youtube.com/playlist?list=UUDhM2k2Cua-JdobAh5moMFg) | 网页已核对 |
| NMIXX | [NMIXX](https://www.youtube.com/c/NMIXXOfficial) | `UCnUAyD4t2LkvW68YrDh7fDg` | [`UUnUAyD4t2LkvW68YrDh7fDg`](https://www.youtube.com/playlist?list=UUnUAyD4t2LkvW68YrDh7fDg) | 网页已核对 |
| DAY6 | [DAY6](https://www.youtube.com/DAY6Official) | `UCp-pqXsizklX3ZHvLxXyhxw` | [`UUp-pqXsizklX3ZHvLxXyhxw`](https://www.youtube.com/playlist?list=UUp-pqXsizklX3ZHvLxXyhxw) | 网页已核对 |
| Xdinary Heroes | [Xdinary Heroes](https://www.youtube.com/c/xdinaryheroesofficial) | `UCO9GhtdQcCRf67GIdSQ0HNQ` | [`UUO9GhtdQcCRf67GIdSQ0HNQ`](https://www.youtube.com/playlist?list=UUO9GhtdQcCRf67GIdSQ0HNQ) | 网页已核对 |
| KickFlip | [KickFlip](https://www.youtube.com/@kickflip_jype) | `UCmq9jjpHA69PwAwlA0DwOsg` | [`UUmq9jjpHA69PwAwlA0DwOsg`](https://www.youtube.com/playlist?list=UUmq9jjpHA69PwAwlA0DwOsg) | 网页已核对 |
| NiziU | [NiziU Official](https://www.youtube.com/channel/UCHp2q2i85qt_9nn2H7AvGOw) | `UCHp2q2i85qt_9nn2H7AvGOw` | [`UUHp2q2i85qt_9nn2H7AvGOw`](https://www.youtube.com/playlist?list=UUHp2q2i85qt_9nn2H7AvGOw) | 网页已核对 |
| NEXZ | [NEXZ](https://www.youtube.com/channel/UC-o9yrZxu5Ru-DVGhnmeTug) | `UC-o9yrZxu5Ru-DVGhnmeTug` | [`UU-o9yrZxu5Ru-DVGhnmeTug`](https://www.youtube.com/playlist?list=UU-o9yrZxu5Ru-DVGhnmeTug) | 网页已核对 |
| J.Y. Park | [J.Y. Park](https://www.youtube.com/user/jypark) | `UCJzd6hPg7Iz35SkBNzAjjWQ` | [`UUJzd6hPg7Iz35SkBNzAjjWQ`](https://www.youtube.com/playlist?list=UUJzd6hPg7Iz35SkBNzAjjWQ) | 网页已核对 |
| 2PM | [2PM](https://www.youtube.com/user/2pm) | `UCBpzJvEhkemwMOkYLq9yUsA` | [`UUBpzJvEhkemwMOkYLq9yUsA`](https://www.youtube.com/playlist?list=UUBpzJvEhkemwMOkYLq9yUsA) | 网页已核对 |
| BOY STORY | [BOY STORY](https://www.youtube.com/c/BOYSTORYOfficial) | `UCZlgP_2MRnrPXRmqR5320BQ` | [`UUZlgP_2MRnrPXRmqR5320BQ`](https://www.youtube.com/playlist?list=UUZlgP_2MRnrPXRmqR5320BQ) | 网页已核对 |
| YAOCHEN | [YAOCHEN_OFFICIAL](https://www.youtube.com/channel/UCotuyOt3sduFSaL80X_tEVA) | `UCotuyOt3sduFSaL80X_tEVA` | [`UUotuyOt3sduFSaL80X_tEVA`](https://www.youtube.com/playlist?list=UUotuyOt3sduFSaL80X_tEVA) | 网页已核对 |
| GIRLSET | [GIRLSET](https://www.youtube.com/@girlset) | `UCSskmnvIhEy3nSZxxVKTeIg` | [`UUSskmnvIhEy3nSZxxVKTeIg`](https://www.youtube.com/playlist?list=UUSskmnvIhEy3nSZxxVKTeIg) | 网页已核对 |

### 待验证与边界

- [JYP 目录](https://www.jype.com/ko/Artist)列有 **CIIU**，但本次页面没有给出可核对的 YouTube 入口；频道 ID 与上传列表 ID 均为**待验证**，不填猜测值。历史艺人是否纳入也待产品范围确认。
- 这些频道在 JYP 官网上有链接，**但各频道是否属于 YouTube 认可的同一内容所有者，本轮无法确认**。尤其 NiziU 等跨地区频道不可仅凭 JYP 目录推断内容所有权。
- JYP 主频道视频归属艺人、视频类型（Performance/Teaser 等）、回归或演出日期，不能只用标题规则当成官方事实。未分类内容进入人工核对队列；日历不从上传时间推断活动日期。
- 没有 API Key，本轮没有实测 `channels.list`、`playlistItems.list`、`videos.list` 的生产响应，也没有验证配额账户设置。API 级 ID 再确认列为 2B 首个数据关卡。
- [YouTube API 开发者政策](https://developers.google.com/youtube/terms/developer-policies)对跨内容所有者的 API 数据聚合、公开展示、缓存与品牌标识有要求。**合并多频道为一条公开 Feed 前，需要核对其适用范围和各频道内容所有权；不能把“JYP 官网列出”当作聚合许可。**如不满足，应改为分频道展示、争取许可或改用允许的官方链接展示方案。当前站内本地托管的九张旧视频封面，也应在 2B 素材策略中单独核对；不自动复制未来 API 缩略图到仓库。

## 3. 零成本接入设计（待 2B 实施）

### 请求路径与最小化配额

1. 在 Google Cloud 创建独立项目，启用 YouTube Data API v3，创建受 API 范围限制的 key；仅存入 GitHub 仓库 `YOUTUBE_API_KEY` Secret。前端构建环境不注入密钥，日志不输出带 key 的 URL。创建 Secret 的官方路径见 [GitHub 文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)。
2. 首次用一次 `channels.list(part=snippet,contentDetails,id=...)` 批量确认各频道 ID 与 `relatedPlaylists.uploads`；运行期每周复核一次映射。不要用 `search.list` 发现新视频；官方上传列表更准确、请求更少。
3. 每次对已确认上传列表调用 `playlistItems.list(part=contentDetails,snippet,maxResults=50)`。正常只取最新一页；有积压时向后翻页，直到覆盖最近同步的安全窗口并连续遇到已知 ID，单频道最多三页。到上限仍有未知视频就标记“需要补扫”，不默默声称完整。
4. 对新 ID 和最近仍展示的视频按最多 50 个一组调用 `videos.list(part=snippet,status,id=...)`，取得视频真实 `publishedAt`、`channelId`、标题、可用缩略图及公开状态；ID 与所属频道不一致或不公开的条目拒收。只保留前端需要的字段。使用 `videoId` 去重，JYP 主频道的艺人归属用可审计的人工映射，不自动猜测。
5. 数据与元信息写入静态 JSON，构建后由 GitHub Pages 的 `/seoul-os/data/` 提供。DEMO 另存且独立标识，默认实时列表不得把 DEMO 混作官方更新。页面显示“最近成功同步”时间和失败后的过期状态。

[`channels.list`](https://developers.google.com/youtube/v3/docs/channels/list)、[`playlistItems.list`](https://developers.google.com/youtube/v3/docs/playlistItems/list)、[`videos.list`](https://developers.google.com/youtube/v3/docs/videos/list) 当前官方文档均为每次 **1 quota unit**；列表单页最多 50 项，`channels.list` 可用逗号分隔的 ID 批量请求。Google 当前文档列出的默认配额为其他端点合计 **10,000 units/日**，实际以项目控制台为准。[配额表](https://developers.google.com/youtube/v3/determine_quota_cost)

| 场景 | 计算 | 估计每日配额 |
| --- | --- | ---: |
| 推荐：15 个上传列表、每日 2 次，每次各取 1 页；每次 1–2 个视频详情批次 | `15 × 2 × 1 + (1–2) × 2` | 32–34 units |
| 有积压：每个频道每次最多 3 页，视频详情上限每次 10 批 | `15 × 2 × 3 + 10 × 2` | ≤110 units |
| 频道映射每周复核 | `channels.list` 批量 1 次 / 周 | 当日额外约 1 unit |

上述为**容量预算而非实际用量**；真正的新视频量、翻页次数与 API 错误重试会改变结果。对重试设置指数退避与每日预算上限，超过预算停止并保留旧数据。建议先每日 **09:17、21:17 北京时间**（`01:17、13:17 UTC`）同步，再根据实际更新量调整。GitHub 定时任务可能延迟或被丢弃，公开仓库长期无活动还可能被停用，故保留 `workflow_dispatch` 手动补跑和同步时间提示。[GitHub schedule 文档](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

### 静态 JSON 数据模型

建议 `public/data/videos.v1.json` 仅存验证过的官方 API 记录；演示条目单独保留。以下是**结构示意，不是真实视频数据**：

```json
{
  "schemaVersion": 1,
  "generatedAt": "<ISO-8601 UTC>",
  "lastSuccessfulSyncAt": "<ISO-8601 UTC>",
  "source": "youtube-data-api-v3",
  "status": "fresh",
  "items": [
    {
      "id": "yt:<videoId>",
      "videoId": "<11-character YouTube ID>",
      "channelId": "<verified UC ID>",
      "artistIds": ["<curated artist ID>"],
      "title": "<API title>",
      "publishedAt": "<ISO-8601 UTC from video.snippet.publishedAt>",
      "thumbnailUrl": "<API-provided HTTPS URL>",
      "sourceUrl": "https://www.youtube.com/watch?v=<videoId>",
      "sourceLabel": "YouTube / <verified channel name>",
      "verification": "official-channel",
      "contentType": "unclassified",
      "syncedAt": "<ISO-8601 UTC>"
    }
  ]
}
```

`videoId` 是全局去重键；`artistIds` 允许一条内容关联多个艺人，但必须有可追溯的编辑证据。`contentType` 是产品编辑分类，不能伪装为 YouTube 官方类型。保留原始 UTC 时间戳，前端按用户时区显示；KST/北京时间活动时间另由日历事件的 IANA 时区处理。不要把网页“视频索引日期”替换为 API 上传时间。

**保存与失效**：只有完整 API 响应、字段验证、去重和 JSON schema 校验成功，才原子替换上次成功快照；失败时原快照和已部署站点保持不变并显示最近成功时间。按 [YouTube API 数据存储政策](https://developers.google.com/youtube/terms/developer-policies)核对缓存期限：公开非授权 API 元数据一般应在 30 天内刷新或删除；不能无限期用“失败保留旧数据”绕过期限。超过期限仍无法刷新时，停止公开展示过期元数据并只保留可重新查询的 ID/自有收藏状态。标题和缩略图定期刷新，删除或私有化的视频从实时列表移除。当前本地收藏 ID 可保留，但若元数据已不可用，Archive 应显示“视频资料暂不可用”及原视频链接，而不是丢失用户收藏。

### GitHub Actions 与部署边界

- 新增 `sync-youtube.yml`：`schedule` + `workflow_dispatch`，标准 Ubuntu runner；仅该受信任的工作流读 Secret，不在 PR/fork 事件暴露。`permissions` 对同步提交使用 `contents: write`，对部署使用 `pages: write`、`id-token: write`，按 job 最小授权。同步脚本只接收环境变量中的 key，不打印请求 URL、响应中的敏感信息或环境变量。
- 步骤：检出最新 `main` 与现有 JSON → API 取数 → 验证频道/视频字段、唯一性、时间和 URL → 输出新旧数量、每频道请求数、失败原因与同步时间 → 写临时文件并原子替换 → 只在有效变化后提交数据文件 → 构建和上传 Pages artifact → 部署。API 失败则不提交、不部署，保留上一次成功页面；由 Actions 失败状态提示维护者。
- 用同一套构建/部署步骤服务代码推送与同步，避免两套逻辑漂移；两个流程共用部署并发组。GitHub 官方说明：由工作流的 `GITHUB_TOKEN` 推送造成的普通 `push` **不会自动触发另一个工作流**，因此数据同步流程必须在本次运行中直接部署，或显式触发可复用部署流程。[触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)
- 同步提交前拉取最新主分支并检测冲突，绝不强制推送；校验失败或冲突时维持上次已部署的 JSON。Pages 路由继续使用 `HashRouter` 和 `/seoul-os/` base，数据请求统一由 `import.meta.env.BASE_URL` 生成。

### 费用与政策关卡

按上述请求量、当前公开仓库与标准 GitHub runner，预计 **$0/月**：YouTube Data API 计划在默认配额内，GitHub 官方文档说明公开仓库的标准 Actions runner 和 GitHub Pages 用量免费。Google 项目、实际配额、GitHub 套餐和政策可能变化，启用前以各自控制台为准；本轮没有创建收费服务或 API Key。[YouTube 配额](https://developers.google.com/youtube/v3/determine_quota_cost) · [GitHub Actions 计费](https://docs.github.com/en/billing/concepts/product-billing/github-actions) · [GitHub Pages 可用性](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

**实施前置关卡**：YouTube 政策的多频道聚合、API 数据存储期限、缩略图/品牌展示与公开网站适用性需要逐条确认。该问题不应以“非商用”直接跳过。确认不满足时，先调整产品展示方式或取得许可，再启用多频道自动 Feed。[YouTube API 开发者政策](https://developers.google.com/youtube/terms/developer-policies)

## 4. Phase 2B 实施顺序（需用户确认后开始）

1. 核对多频道聚合与素材展示政策；确定可接入频道清单、JYP 主频道归属规则和 DEMO 分层。
2. 建立 Google Cloud 项目和受限 API Key，由仓库所有者将 `YOUTUBE_API_KEY` 存入 GitHub Secret；不进入前端或 Git 历史。
3. 用一次 `channels.list` 复核本报告的 15 对 `channelId`/`uploadsPlaylistId`，处理 CIIU 等待验证项；产出机器可读的、带证据的频道配置。
4. 编写增量同步脚本、JSON schema、去重与过期策略；用模拟 API 响应测试新增、重复、删除、超配额、部分失败和异常字段。
5. 建立定时/手动 Actions 流程，在测试分支或可检查的构建产物中先试跑；确认失败不覆盖已部署快照，再启用自动提交和部署。
6. 新增前端数据适配层与加载/过期/空状态，保持真实官方数据与 DEMO 显著分开；把动态 ID 纳入收藏，不因 feed 更新删掉用户的 `localStorage` 选择。
7. 复测筛选、搜索、Archive、关注、移动端、静态资源与 GitHub Pages 子路由；上线后观察同步日志、配额与数据来源，必要时回退到上一份成功 JSON。

本报告完成后停在 2A；没有接入 Supabase、AI 聊天、付费聚合服务或未经验证的实时数据。
