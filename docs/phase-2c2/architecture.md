# Phase 2C-2 架构

实施前审计见 [`../phase-2c2-architecture-audit.md`](../phase-2c2-architecture-audit.md)。沿用 React/Vite、`/seoul-os/` base、HashRouter、既有 14 个 `artistId`、`seoul-os-follow-v1` 与 GitHub Pages；原有视频数据结构、收藏键和 JYP 官网仅链接策略不变。

```text
Ticketmaster API（仅经核实的 Attraction ID） ─┐
                                               ├→ 逐来源校验/去重/状态复核 → data/calendar/events.json
人工审核文件（明确官方证据链接） ────────────────┘                                │
                                                                       构建前再校验/移除
                                                                             │
                                                      public/data/calendar/events.json + all.ics
                                                                             │
                                                      React Calendar（只读、北京时区展示）

YouTube 预约直播 → 独立单频道只读试点；不写入上方公共日历或 ICS。
```

`src/calendar/types.ts` 定义统一内部事件结构。`engine.ts` 负责运行时校验、来源 URL、IANA 日期、同 ID 合并、生命周期、审核候选及新鲜度；`ics.ts` 负责 RFC 5545 序列化和浏览器下载。Ticketmaster、人工审核、YouTube 试点分别位于 `scripts/events/`。`stage-public-data.mjs` 是公开数据最后一道校验门。

事件以 `source + sourceEventId` 固定身份；没有日期的事件不进入月历。Ticketmaster 与人工事件可共用内部模型，但 YouTube 直播受数据聚合政策约束，不进入公开跨频道日历。活动与售票开始时间为不同事件；仅当 API 明确给出未来 `sales.public.startDateTime` 时，Ticketmaster 适配器创建单独售票日事件，不从标题推测开售时间。

自动同步使用北京时间 08:15、20:15 对应的 UTC 00:15、12:15。无变更不提交；数据变更使用原子替换、提交后调用既有可复用 Pages workflow。GitHub 定时触发可能延迟。`GITHUB_TOKEN` 推送不会自动触发另一个 push workflow，因此同步工作流直接调用部署。与 YouTube 同步相差 15 分钟，并在提交前 rebase，减少写入竞争。
