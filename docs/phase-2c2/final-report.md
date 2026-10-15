# SEOUL.OS Phase 2C-2 最终验收报告

验收日：2026-10-15（北京时间）。仓库 [`faxiusanda9-coder/seoul-os`](https://github.com/faxiusanda9-coder/seoul-os)；代码提交 [`9af0084`](https://github.com/faxiusanda9-coder/seoul-os/commit/9af0084385f27fb45e52f83b4f85db6fa6bf0d82)，独立试点提交 [`39e1281`](https://github.com/faxiusanda9-coder/seoul-os/commit/39e12812253aafb253f9311057d915e97b1373c2)。本报告只记录已证实的功能和限制；线上日历当前仍为 **0 条真实活动**。

## 项目经理摘要

**已完成**：独立事件模型、Ticketmaster Discovery 适配器和身份核验闸门、人工审核与紧急移除、日期/状态追踪、北京时区日历、关注艺人筛选、单条及批量 ICS、公开空 ICS、定时工作流、隐私与来源说明、响应式浏览器验收。既有 YouTube 视频、收藏、分类与官网入口未退化。

**实际成果**：新数据链路在 Actions 完成一次无变更同步，Pages 新版部署成功；静态日历 JSON 和 ICS 线上可访问。Actions 中使用已有 YouTube Key 做了一次 **TWICE 单频道只读 `videos.list` 真实请求**，检查 50 个已有 videoId，返回 50 个视频资源，符合 upcoming 条件的预约直播 **0 条**，未发布跨频道直播日历。Ticketmaster Secret 在 Actions 日志中为未配置，故没有真实 Attraction 或 Event 请求。

**仍然缺失**：Ticketmaster API Key、14 位艺人的 Attraction ID 实际核验、真实演出覆盖、真实日程自动发现、公开 YouTube 直播展示许可确认。用户目前需完成的唯一外部账户步骤是：按 [Ticketmaster 官方 Getting Started](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/)注册开发者账户取得 Consumer Key，并在本仓库 **Settings → Secrets and variables → Actions → New repository secret** 新增 `TICKETMASTER_API_KEY`；不要把密钥发到聊天或提交到仓库。配置后仍须运行身份调查并逐一核实 Attraction ID，不能直接把关键字候选上线。

## Gate 结果

| Gate | 结果 | 证据 |
|---|---|---|
| 0 架构审计 | PASS | [实施前审计](../phase-2c2-architecture-audit.md)记录旧演示日历、14 个 ID、Pages 与工作流关系；保留旧演示开关和 localStorage 键。 |
| 1 数据源覆盖 | BLOCKED | [来源矩阵](source-coverage.md)：14 位艺人列入注册表；Ticketmaster 密钥缺失，实际 API 调查 0、核实 Attraction ID 0。 |
| 2 事件引擎 | PASS（本地样本） | 21/21 活动单测、严格 Schema、去重、时区/夏令时、状态变化、失效/移除、ICS。测试 Fixture 不是线上事实。 |
| 3 真实来源接入 | PARTIAL | [YouTube 只读试点](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662893635)成功调用 1 次 API；0 条确认预约直播。Ticketmaster 真实请求 0。 |
| 4 日历产品 | PARTIAL | 空状态、8 个官网入口、筛选、关注联动、ICS、错误反馈与视口布局通过生产浏览器测试；线上活动 0，尚无真实活动卡可验收。 |
| 5 自动化部署 | PASS（推送触发） | [Calendar Sync](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662672492)和[Pages Deploy](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662672457)均 success；第二轮[试点 Sync](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662893635)和[Deploy](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662893823)亦 success。尚不能声称两个定时周期稳定运行。 |

## 数据源与真实数量

| 来源 | 覆盖身份 | 实际请求 | 发现 | 核实 | 发布 | 说明 |
|---|---:|---:|---:|---:|---:|---|
| Ticketmaster Attraction / Events | 注册 14，核实 ID 0 | 0 | 未查询 | 0 | 0 | Actions `credentialConfigured=false`；0 条不是无演出结论。 |
| JYP 官网 | 8 个已核实 Schedule 入口 | 自动请求 0 | 不抓取 | 0 | 0 | 保持仅链接，缺少自动读取/再发布许可。 |
| YouTube 预约直播 | TWICE 单频道试点 | `videos.list` 1 次 | 50 个资源中候选 0 | 0 | 0 | uploads 快照覆盖不完整，且跨频道公共发布未授权。 |
| 人工审核 | 14 位艺人可录入草稿 | 不适用 | 当前草稿 0 | 0 | 0 | 需要真实官方永久详情页与审核。 |

排除或隐藏的**真实**活动数为 0；没有真实 API Event 结果可供分类或排除。测试中构造的 2 条 Fixture、2099 年旧演示样例均没有写入 `data/calendar/events.json` 或公开 ICS。实际数据发布日期范围、场馆覆盖和最近来源核实时间：尚不适用。

## 自动化、页面与成本

`.github/workflows/calendar-sync.yml` 定时为 UTC 00:15、12:15，即北京时间 08:15、20:15，支持 `workflow_dispatch`。首轮实际运行日志：`changed=false`、`ticketmaster=blocked`、`credentialConfigured=false`、`manual=0`、`published=0`，因此跳过数据提交与工作流内重复 Pages 部署；普通代码 push 的 Pages 工作流已成功部署。现有 YouTube 同步仍保持原计划。单频道失败不会覆盖其他来源；合法旧 Ticketmaster 元数据 7 天后不再公开，30 天后从运行快照删除。没有变化不提交。

线上地址：[SEOUL.OS Calendar](https://faxiusanda9-coder.github.io/seoul-os/#/calendar)。实际请求 [日历 JSON](https://faxiusanda9-coder.github.io/seoul-os/data/calendar/events.json) 返回 **200 / schema 1 / 0 events / ticketmaster blocked**；[公开 ICS](https://faxiusanda9-coder.github.io/seoul-os/data/calendar/all.ics) 返回 **200** 且是有效 VCALENDAR。既有 [TWICE JSON](https://faxiusanda9-coder.github.io/seoul-os/data/youtube/twice.json) 仍为 schema 3、50 条。HashRouter 与 `/seoul-os/` 静态子路径继续工作。

Ticketmaster 本阶段实际 0 请求、0 配额。14 位艺人各 1 页、每日两次的未来基础预算约 **28 请求/日**，分页、重试、身份复核另计；官方 Discovery 文档写 5 req/s，FAQ 写 2 req/s，代码采用保守的 2 req/s。YouTube 独立试点实际 **1 次 `videos.list` 请求**，按官方价目估算 **1 quota unit**；不是 Google Cloud 实际账单数。未创建付费服务或额外云项目，平台最终计费状态未通过账单核实。

## 用户体验与工程质量

用户可在 Calendar 切月、选艺人和已有类型、勾选“仅看关注艺人”、点击日期查看来源与时区；有核实事件时可打开原始页面并下载 ICS。来源文案区分 Ticketmaster 与官网；后续单频道 YouTube 若得到政策许可也应明确单独标识。改期和取消使用显式状态；售票日期只有在 API `sales.public.startDateTime` 明确且未来时才生成独立事件，不与演出日期混淆。当前没有真实卡片，页面如实显示“暂时没有已确认的站内日程”，下方 8 个官网入口仍可用；网络加载失败与真实零记录是不同反馈。公开 ICS 可订阅，客户端刷新时间不保证；关注艺人 ICS 是浏览器本地下载，不是假装服务器私有订阅。

[测试记录与截图](test-results.md)：TypeScript、生产构建通过；活动单测 **21/21**，既有同步 **9/9**、分类 **4/4**、官网 **4/4**、语言 **1/1**。本地及生产 Playwright 在 375、412、768、1440 宽度检查无横向溢出与页面异常，线上 JSON/ICS 可读取；用浏览器临时拦截注入的测试事件验证 BJT、单条 ICS、筛选、关注刷新及网络失败反馈。视频分类/Archive 和官网/X 回退旧浏览器脚本也通过。构建存在既有主 JS 包 >500 kB 的非阻断警告。

## 尚未解决与下一步

1. Ticketmaster Key 尚未建立为 Actions Secret；14 个艺人实际 Attraction 身份、未来活动数与地区覆盖没有真实 API 证据。取得 Key 后先运行候选调查并人工核实，再分批启用 TWICE、Stray Kids、ITZY，不能跳过身份闸门。
2. 上传列表中的 50 个 TWICE 视频无 upcoming 候选，不足以排除频道其他预约直播。`search.list` 尚未启用，也没有公开跨频道 YouTube 直播视图。公开聚合需另行核对平台许可。
3. JYP 官网公告/行程仍缺少自动提取与再发布授权，只提供官方链接；没有以爬虫绕过限制。人工事件需要具体永久详情链接，当前没有可发布人工记录。
4. Ticketmaster 的真实 401/429、活动取消/改期仍只有本地模拟测试，未在真实来源上触发。权利人 24 小时移除的自动化路径已实现，但及时提交和 Pages 发布仍需维护者实际响应。YouTube 与 Ticketmaster 隐私/品牌合规应在实际大规模发布前再次审核，现有隐私说明不代表平台个别批准。
5. 两个 cron 时段的长期成功率、第三方日历订阅刷新行为及有真实活动时的手机呈现，需在有实际事件后持续验收。

## 独立结论

- **Engineering Status: PASS** — 已上线的事件基础设施通过本地自动化、真实 Actions 构建与生产 Pages 加载；Ticketmaster API 实际业务结果未列为通过。
- **Live Data Status: PARTIAL** — 单频道 YouTube 只读请求成功，但真实预约直播为 0；Ticketmaster 因凭据/身份闸门受阻，真实活动发布 0。
- **Product Status: PARTIAL** — 日历交互和导出路径可运行，真实活动覆盖与最终价值尚未实现。
