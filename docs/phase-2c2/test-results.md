# Phase 2C-2 测试记录

本地执行日期：2026-10-15。**Fixture 只在 Node/Playwright 测试中使用，不属于线上真实活动。**

## 自动化结果

| 检查 | 结果 | 边界 |
|---|---|---|
| `npm run test:calendar` | 21/21 通过 | 严格数据校验、夏令时/跨日、售票状态与取消区分、真实开售时间单独建事件、去重、异常生命周期、7/30 天保留、ICS、Ticketmaster 401/429/500/分页、人工审核、YouTube 独立候选；均为本地样本 |
| `npm run test:sync` | 9/9 通过 | 既有 YouTube 回归 |
| `npm run test:taxonomy` | 4/4 通过 | 既有分类回归 |
| `npm run test:official` | 4/4 通过 | 既有官网入口和 X 来源回归 |
| `npm run test:i18n` | 1/1 通过 | 中英字典参数一致 |
| `npm run check` | 通过 | TypeScript 7 严格检查 |
| `npm run build` | 通过 | 14 个频道快照、0 条已核实事件 staged；有既存主 JS 包 >500 kB 非阻断警告 |
| `npm run sync:calendar` 重复运行 | `changed=false` | 无密钥、无人工批准事件；没有无意义数据提交 |
| `npm run calendar:coverage` | `blocked` | 14 位注册、0 次真实 Attraction API 调查 |
| 本地 `npm run calendar:pilot:youtube` | `blocked` | 本地无 YouTube Key；线上独立试点结果见下节 |

## 浏览器检查

使用本地 Vite、Playwright Core、Edge Headless，在 **375×812、412×915、768×1024、1440×900** 均检查：公开形态 JSON 200 且 `events=[]`、ICS 200、8 个官方日程链接、默认零演示事件；随后仅在浏览器拦截 JSON 注入 **2 条明确标注的测试 Fixture**，验证日期点击、北京时间 KST 19:00→BJT 18:00、艺人筛选、单条 ICS 下载、关注艺人筛选、刷新后关注持久化。最后阻断 JSON 请求，验证“数据暂时无法读取”错误状态。四种尺寸均无 `pageerror`、无横向溢出，文档宽度等于视口宽度。

截图：[375px 真实空状态](screenshots/empty-mobile-375.png)、[1440px 测试 Fixture 视图](screenshots/fixture-desktop-1440.png)。第二张图中的事件标题为 Fixture，不是已发布的真实活动。底部移动导航在手机视口内正常显示；固定导航在全页拼接截图中的位置可能与正常滚动不同，此处提供视口截图。

既有 Playwright 回归脚本：`taxonomy-e2e.cjs` 在 375、1440 宽度检查 50 条 TWICE 数据、分类、搜索、Archive 收藏和刷新，无页面错误或溢出；`official-e2e.cjs` 在 375、412、1440 宽度检查 10 个官网入口、8 个行程链接、X 失败回退、日历入口与路由刷新，全部通过。这些脚本位于当前工作区的 `work/e2e/` 辅助测试目录，不会随网站部署。

## 线上验收

- [Calendar Sync 首轮](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662672492)：sync Job success，`changed=false`，无意义提交与重复部署被跳过；日志 `credentialConfigured=false`、`published=0`。
- [TWICE 直播只读试点](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662893635)：pilot Step success，`status=queried`、请求 1 次、检查 50 个 videoId、返回 50 条、符合 upcoming 条件 0 条；Calendar Sync 仍为 `changed=false`。
- [Pages 首轮部署](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662672457)：build/deploy Jobs success。线上主页 200，`/seoul-os/data/calendar/events.json` 200 且 schema 1、事件 0，`/seoul-os/data/calendar/all.ics` 200 且包含 `BEGIN:VCALENDAR`；既有 TWICE JSON schema 3、50 条。
- 生产 Playwright 在 375、412、768、1440 宽度重复空状态、JSON/ICS、链接、无溢出与无页面异常检查；**后续注入的 2 条 Fixture 只存在于浏览器拦截响应中**，用于测试时区、ICS、关注和失败反馈，线上原始 JSON 仍是 0 条。

## 尚未实测

没有 Ticketmaster Key 与已核实 Attraction ID，故未进行真实 Ticketmaster 请求、覆盖率查询或活动结果验收。YouTube 的**已检查 50 个视频**并不代表频道所有预约直播；没有启用公开直播视图。定时任务长期稳定性不能由这两次推送触发代替两个实际定时周期证明。
