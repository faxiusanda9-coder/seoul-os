# Event Engine 设计与维护

## 身份、时间、发布

- 稳定 ID：`tm-<Ticketmaster eventId>`、`manual-<UUID>`、`yt-<videoId>`。同标题、同城市或同日期均不自动合并；跨来源相似记录只产生人工审核候选。
- `timePrecision=datetime` 要求 ISO 时间、IANA 时区、当地日期和时间相互一致；`date` 仅保留当地日历日；`unknown` 不进入月历。UI 使用 `Intl.DateTimeFormat` 转北京时间，避免美国夏令时的固定偏移错误。
- `verification=verified`、来源 URL 安全、艺人身份明确、日期有效且 `published=true` 才能进入公开日历。YouTube 即使内部核实也被公共发布函数排除。Ticketmaster `sales.public.startDateTime` 若明确且在未来，创建独立 `tm-sale-<eventId>` 售票日事件；不把演出日充作开售日。
- 生命周期分别支持 scheduled、postponed、rescheduled、cancelled、completed、unknown。`onsale/offsale` 是售票状态，不自动视为活动取消。意外的“取消后重新安排”转换进入人工复核，不立即公开。
- API 失败或某次搜索结果缺失不等于取消。未重新核实的 Ticketmaster 元数据在 7 天后从公开视图隐藏，30 天后从运行快照删除；人工审核数据不受 API 失败覆盖。`removals.json` 是优先级最高的移除登记。

## Ticketmaster Adapter

只查人工核实的 Attraction ID，不用模糊艺人名直接发布。每位艺人独立查询未来 180 天，`size=50`、最多 10 页，受官方 1000 条深分页限制；结果中的 `_embedded.attractions[].id` 还要与核实 ID 一致。401/403 立即停止，429 尊重有限 `Retry-After`，5xx 最多 3 次，10 秒超时；错误日志不包含带 `apikey` 的 URL。请求间隔至少 550ms，按 FAQ 较严的每秒 2 次限速。艺人失败时保留其他来源数据。

## ICS

`src/calendar/ics.ts` 使用 CRLF、UTF-8 75 octet 折行、RFC 5545 特殊字符转义、稳定 UID、SEQUENCE、DTSTAMP、取消状态。仅日期事件使用 `DTSTART;VALUE=DATE` 与次日排他性 `DTEND`；不添加不存在的时间。单条与筛选结果由浏览器即时下载，公开 `all.ics` 由构建生成。个人关注状态只在浏览器中，不存在服务器私有订阅 URL。

## 人工审核与移除

`data/calendar/manual-events.json` 的草稿不会公开。`event:manual add` 创建 draft；维护者核实与该艺人对应的已确认官网 Schedule/Notice 详情或已确认 X 账号帖文后，`event:manual review` 检查艺人、来源、日期和必填字段，才设置 approved。改动已批准活动必须更新审核时间；否则引擎将改动标为待复核并停止公开。

权利人要求移除时，`npm run event:remove -- --id=...` 立即把 ID 写入 `removals.json`、清除快照并重新生成 ICS；尽快提交和部署，目标满足 Ticketmaster 条款的 24 小时移除要求。部署不成功时必须人工跟进，不可仅依赖定时运行。
