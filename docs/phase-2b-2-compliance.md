# Phase 2B-2：YouTube API 数据展示合规边界

核对日期：2026-10-14。以下是按公开官方政策作出的产品与工程约束，不是 YouTube 对 SEOUL.OS 的个别许可或法律意见。

## 官方条款与当前判断

| 条款 | 官方依据 | 对本项目的约束 |
| --- | --- | --- |
| III.E.2 Data Aggregation | [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies#e-handling-youtube-data-and-content) | 原则上不得聚合 API Data。例外要求频道属于 YouTube 根据内容许可协议认可的同一内容所有者，且聚合结果**仅供该内容所有者查看**。JYP 官网列出多个艺人，不能证明满足此例外；公开统一视频时间线不能上线。 |
| III.E.4 Refreshing, Storing, and Displaying API Data | [同一政策 III.E.4](https://developers.google.com/youtube/terms/developer-policies#e-handling-youtube-data-and-content) | 有限的非授权公开元数据应在 30 个日历日内刷新或删除；应尽可能反映标题、缩略图、可用性变化。过期快照不得作为当前官方内容展示。 |
| III.E.1 Audiovisual Content | [同一政策 III.E.1](https://developers.google.com/youtube/terms/developer-policies#e-handling-youtube-data-and-content) | 不下载、缓存或镜像视频文件。仅保存必要的 API 元数据与原始缩略图 URL。 |
| III.F.2 Branding | [开发者政策](https://developers.google.com/youtube/terms/developer-policies#f-user-experience)、[YouTube Branding Guidelines](https://developers.google.com/youtube/terms/branding-guidelines) | 含 YouTube 内容的页面要明确标识来源；不能暗示 SEOUL.OS 是 YouTube 或 JYP 官方应用。品牌素材若使用，需按官方尺寸、链接与不可修改要求处理。 |
| 展示与用户体验 | [Developer Policies Guide](https://developers.google.com/youtube/terms/developer-policies-guide) | 保留原始标题和缩略图，不虚构 YouTube 官方分类或翻译；内容链接回 YouTube。产品自定义类型需明确标为 SEOUL.OS 分类。 |

## 本阶段采取的边界

1. 每个频道有独立配置、独立 API 校验、独立 JSON 文件。任何时刻的公开实时视频列表只加载并展示**用户当前选择的一个频道**；切换频道会替换视图，不会把多个频道的 API 数据拼接、统一排序或统计。
2. Artists 页面作为艺人目录；艺人详情展示对应独立频道。Discover 提供频道选择入口并只显示当前频道视频。全站搜索不生成跨频道视频搜索结果；视频搜索和类型筛选限定在当前频道。
3. 用户私人的收藏意图只保存稳定 `yt-<videoId>` 和分类等本地状态。Archive 按频道分别查看可用元数据；元数据失效时只保留最小视频 ID 与不可用占位，不长期缓存标题或缩略图。
4. `JYP Entertainment` 主频道不按标题自动分配给个别艺人；缺少独立、可核实频道的艺人不伪造上传列表。`CIIU` 不启用同步。
5. 每条实时卡标明 YouTube 来源，作品标题保留 API 原文；`type` 是 SEOUL.OS 的编辑分类，不声称是 YouTube 官方类别。演示与历史精选不冒充当日实时数据。

## 已有依据与未确认事项

官方 API 文档明确允许通过 [`channels.list`](https://developers.google.com/youtube/v3/docs/channels/list) 获取频道上传列表，再用 [`playlistItems.list`](https://developers.google.com/youtube/v3/docs/playlistItems/list) 和 [`videos.list`](https://developers.google.com/youtube/v3/docs/videos/list) 读取公开资源；这证明**取数方法**有文档依据，不构成跨频道公开聚合许可。Phase 2A 的 [JYP 官方艺人目录](https://www.jype.com/ko/Artist)链接可用于确认频道入口，但也不能证明 YouTube 所认可的内容所有权或展示例外。

**仍需向 YouTube/权利方确认**：同一粉丝产品内通过导航分别查看多个公开频道是否在具体使用情形下被解释为“聚合”；公开跨频道收藏索引的展示边界；历史提交中的旧 API 元数据如何满足 30 天删除要求；YouTube 品牌素材的具体落地方式。当前采取分频道、无跨频道结果集的保守设计，不能据此宣称获得了个别合规批准。

未来若要上线公开统一 Daily JYP Feed、跨频道排行榜或统计，须取得适用于**公众展示**的明确授权或 YouTube 对该实现的书面确认。仅证明多个频道同属 JYP，甚至证明同一内容所有者，仍不足以满足 III.E.2 的“聚合结果仅供内容所有者查看”条件。未经确认不发布此类功能。
