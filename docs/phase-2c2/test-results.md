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
| `npm run calendar:pilot:youtube` | `blocked` | 本地无 YouTube Key，0 次真实直播 API 请求 |

## 浏览器检查

使用本地 Vite、Playwright Core、Edge Headless，在 **375×812、412×915、768×1024、1440×900** 均检查：公开形态 JSON 200 且 `events=[]`、ICS 200、8 个官方日程链接、默认零演示事件；随后仅在浏览器拦截 JSON 注入 **2 条明确标注的测试 Fixture**，验证日期点击、北京时间 KST 19:00→BJT 18:00、艺人筛选、单条 ICS 下载、关注艺人筛选、刷新后关注持久化。最后阻断 JSON 请求，验证“数据暂时无法读取”错误状态。四种尺寸均无 `pageerror`、无横向溢出，文档宽度等于视口宽度。

截图：[375px 真实空状态](screenshots/empty-mobile-375.png)、[1440px 测试 Fixture 视图](screenshots/fixture-desktop-1440.png)。第二张图中的事件标题为 Fixture，不是已发布的真实活动。底部移动导航在手机视口内正常显示；固定导航在全页拼接截图中的位置可能与正常滚动不同，此处提供视口截图。

既有 Playwright 回归脚本：`taxonomy-e2e.cjs` 在 375、1440 宽度检查 50 条 TWICE 数据、分类、搜索、Archive 收藏和刷新，无页面错误或溢出；`official-e2e.cjs` 在 375、412、1440 宽度检查 10 个官网入口、8 个行程链接、X 失败回退、日历入口与路由刷新，全部通过。这些脚本位于当前工作区的 `work/e2e/` 辅助测试目录，不会随网站部署。

## 尚未实测

没有 Ticketmaster Key 与已核实 Attraction ID，故未进行真实 Ticketmaster 请求、覆盖率查询或活动结果验收。没有本地 YouTube Key，预约直播试点没有真实请求。GitHub Actions 实际运行、Pages 部署与线上 JSON/前端将在发布后单独记录；定时任务长期稳定性不能由一次手动/推送触发证明。
