# 日历使用与维护指南

## 访客

打开 `/#/calendar`，月历默认显示站内已核实事件；点击日期看详情，使用艺人与真实存在的活动类型筛选。勾选“仅看关注艺人”读取此前在艺人页的关注状态。活动卡显示北京时间及来源当地时间；只有日期而没有具体时刻的活动显示“具体时间未公布”。原始来源链接用于核对临时变更。空日历并不代表艺人没有行程，可打开下方 8 个已核实官网入口。

有核实事件时可下载单条或当前筛选结果的 `.ics` 文件。单次导入文件通常**不会自动更新**；公共 `data/calendar/all.ics` 可作为订阅地址，但刷新频率由手机日历客户端决定。浏览器内关注艺人的 ICS 下载不是私人在线订阅地址。当前 0 条事件时公开 ICS 为空日历文件，筛选下载按钮禁用。2099 年演示样例必须主动开启，绝不进入真实 JSON/ICS。

## 维护者

1. 用官方页面核对艺人、活动日、时间精度、时区、来源永久链接；不要把公告发布日期当作活动日。
2. 设置本地 `.env` 的 `TICKETMASTER_API_KEY`（不要加 `VITE_` 前缀），运行 `node --env-file=.env scripts/events/coverage.mjs`；审查候选后在 `data/calendar/ticketmaster-artists.json` 登记真正核实的 Attraction ID 与证据。将 Key 放到 GitHub Actions Secret，不能提交或打印。未取得密钥时此步保持 BLOCKED。
3. 官网可核实但无法自动同步的活动，可运行：

```bash
npm run event:manual -- add --artistId=twice --title="活动原文标题" --eventType=concert --localDate=2026-11-01 --sourceUrl=https://twice.jype.com/schedule/<官方详情ID>
npm run event:manual -- review --id=<上步输出的UUID> --reviewer=<维护者标识>
npm run sync:calendar
npm run test:calendar
npm run build
```

以上仅展示命令格式，不声称例子中的日期有真实活动；`<官方详情ID>` 要换成实际永久详情链接，不能只填官网首页或日程总览。`review` 只接受该艺人已核实的官网 Notice/Schedule 详情路径或已核实 X 账号帖文；包含具体时刻时需填写带偏移的 `startAt`、当地 `localTime` 和 IANA `timezone`，程序会检查一致性。修订已核实事件应更新 `reviewedAt` 并复核来源。

4. 必须移除的事件运行 `npm run event:remove -- --id=<事件ID>`，立即提交并确认 Pages 新版 JSON/ICS。Ticketmaster 权利人移除请求应在 24 小时内完成。

`calendar-sync.yml` 支持手动运行和北京时间 08:15、20:15 定时运行；无数据变化不提交。`npm run calendar:pilot:youtube -- --channel=twice` 是只读单频道试点，使用已有 YouTube Key；不产生公共跨频道日历。官网行程页链接继续供人工核对，不启用爬虫。
