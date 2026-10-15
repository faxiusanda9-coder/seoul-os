# API 使用与政策边界

核对日期：2026-10-15。以下为工程约束，不是平台对 SEOUL.OS 的个别许可。

## Ticketmaster

[Discovery API v2](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)规定 `apikey` 查询参数、401 认证失败、事件/艺人查询及 `dates.status.code`。同一文档写默认 **5 请求/秒、5000 次/日**；[官方 FAQ](https://developer.ticketmaster.com/support/faq/) 写 **2 请求/秒、5000 次/日**。采用较低的 2 请求/秒。未来 14 个艺人每次各 1 页、每日 2 次的基础估算为 28 次/日；身份调查、额外分页、重试另计。实际请求以 Actions 日志和开发者控制台为准；本轮实际为 0。

[General Terms](https://developer.ticketmaster.com/support/terms-of-use/)要求合理期限内缓存、尊重权利人 24 小时内移除请求、披露访客数据处理，不得复制核心购票体验或把 Ticketmaster 当作图床。因此只保存必要事件元数据、原来源链接，不下载图片或提供站内购票；增设 [隐私与来源页面](../../src/pages/PrivacyPage.tsx)及 footer 入口。无密钥不进行 API 请求，不用示例活动冒充实际活动。Ticketmaster 数据不等同 JYP 官方直接确认。

## YouTube 与 JYP 官网

[YouTube 开发者政策 III.E.2、III.E.4](https://developers.google.com/youtube/terms/developer-policies)限制 API 数据聚合并要求有限公开元数据在 30 天内刷新或删除。因此预定直播只做独立单频道读取试点，不进入跨频道公共日历或公开 ICS。`videos.list` 可读取 `liveStreamingDetails.scheduledStartTime`，但仅 `upcoming`、同官方频道、公开且有真实时间的视频才可作为候选；标题含 LIVE 不作为证据。`videos.list` 官方列为 1 单位/次；本地未有 Key，实际请求 0。[视频字段](https://developers.google.com/youtube/v3/docs/videos)、[videos.list](https://developers.google.com/youtube/v3/docs/videos/list)。

JYP 官网维持前阶段的 B 类“仅官方链接”。公开可阅读或 robots 未禁止，不等于允许自动抓取、缓存与再发布。现阶段没有 JYP 官网同步适配器，也不通过网页爬虫填补空日历。未来公开跨频道 YouTube 直播聚合需要平台或权利方明确许可与复核。
