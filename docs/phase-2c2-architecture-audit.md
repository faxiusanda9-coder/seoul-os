# Phase 2C-2 架构审计（实施前）

审计日：2026-10-15。分支 `main`，远端 `faxiusanda9-coder/seoul-os`；开始修改时工作区干净。

## 现状与风险

- `src/types.ts` 的旧 `CalendarEvent` 只支持 3 种演示类型、一个 KST 时间和说明文字；没有统一真实事件模型。`src/data/events.ts` 是 2099 年虚构样例，`CalendarPage` 默认关闭样例，真实事件数为零。
- 先前来源调查只核实了 8 个 JYP 官网 Schedule 导航入口；没有取得官网机器读取、缓存及再发布许可，因此没有官网采集工作流。此限制继续生效。
- `data/youtube/channels.json` 含 14 个已启用频道，频道与 `src/data/artists.ts` 共用 `artistId`；公司频道及 CIIU 不启用。视频按频道独立 JSON 与单频道视图展示；不应将其合并成公共活动流。
- `ArchiveContext` 的 `seoul-os-follow-v1` 可直接供“只看关注”使用。视频收藏独立于日历，不需迁移。
- Vite `base=/seoul-os/`、`HashRouter` 保护 Pages 子路径与刷新。`scripts/stage-public-data.mjs` 负责将可发布数据放到 `public`；后续活动数据应沿用这条构建路径。
- `deploy.yml` 在推送 main 时发布；YouTube 同步用 `GITHUB_TOKEN` 推送后主动调用可复用的 Pages workflow，因为这类推送不会触发普通 push 工作流。新增日历工作流需相同做法，并序列化写入，避免与 YouTube 同步冲突。
- 现有 `test:sync`、`test:taxonomy`、`test:official`、`test:i18n` 覆盖旧功能；尚无活动引擎测试。当前环境没有 `TICKETMASTER_API_KEY`，不能把 Fixture 测试记为真实 API 验收。

## 实施决策

新建独立 `CalendarEventRecord`，保留旧演示类型与开关；事件来源、验证、生命周期、日期精度、UTC 与原始时区显式建模。Ticketmaster 仅在 Attraction ID 经人工核实且有密钥时启用；无密钥时保留 adapter 与测试，不发布样本。人工事件通过仓库文件审核；YouTube 预约直播留在单频道试点，不跨频道公开聚合。真实 Calendar 读取经校验的公开 JSON；仅 VERIFIED 且具有日期的事件进入月历。生成可下载 ICS，浏览器根据已有关注状态生成个人文件，不声称是私有订阅 URL。

Ticketmaster 官方 Discovery 文档称 5 req/s，FAQ 称 2 req/s；采用较严的 **2 req/s**。条款要求合理期限缓存，且权利人要求移除内容后 24 小时内删除；需要短期刷新和显式移除工具。来源：[Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)、[FAQ](https://developer.ticketmaster.com/support/faq/)、[General Terms](https://developer.ticketmaster.com/support/terms-of-use/)。
