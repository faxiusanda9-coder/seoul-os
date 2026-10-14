# Phase 2C / Prompt 002B-C 测试记录

执行日期：2026-10-15。运行环境：Windows、Node.js 24.21.0、Playwright Core + 本机 Edge、Vite 本地服务 `/seoul-os/`。本页区分**离线测试、本地浏览器测试、实际线上部署**；官网页面人工核验不等同于获准自动同步。

| 检查 | 结果 | 证据与边界 |
|---|---|---|
| TypeScript | 通过 | `npm run check` 无错误。 |
| 生产构建 | 通过 | `npm run build`，14 个独立频道快照进入 Pages 子路径构建；既有 529 kB 主包体积警告，未阻断构建。 |
| YouTube 同步回归 | 9/9 通过 | `npm run test:sync`：密钥缺失、API 失败保留、重复同步、私密视频、频道故障隔离等均为**模拟 API**测试，不冒充此次真实 API 调用。 |
| 视频分类 | 4/4 通过 | `npm run test:taxonomy`：冲突规则、描述、700 条 v3 快照、v2 兼容。离线回填第二次运行 0 个变更、0 API 请求。 |
| 官网入口／数据模型 | 4/4 通过 | `npm run test:official`：10 个核实入口、8 个 X 账号、安全 URL、9 类公告标题样本与无时间活动日期约束；没有执行官网自动采集。 |
| 中英文文案 | 1/1 通过 | `npm run test:i18n`；键和参数对应。 |
| 002B-C 浏览器交互 | 375px、1440px 通过 | TWICE 50 条：舞台 3、幕后 5、综艺 7、粉丝向 1、其他 34；空的公告视频／音乐／直播不显示。搜索 Behind 得 5 条，空搜索可清除，收藏刷新仍在 Archive；无 pageerror 和横向溢出。 |
| 002C-1 浏览器交互 | 375×812、412×915、1440×900 通过 | `/official` 显示 10 个核实入口；按 TWICE 筛选得 1，搜索无结果可清除。Calendar 默认 0 真实活动、8 个官方行程外链，月份可切换。X 脚本点击前未加载；**模拟拦截脚本**时失败说明和官方账号外链可用。无 pageerror 和横向溢出。 |
| 实际 X widget 渲染 | 未确认 | 本地自动化验证的是主动加载和失败降级；无法证明各用户网络下嵌入成功。X 帖文不进入本地 JSON。 |
| 官网公告／活动在线同步 | 未执行 | 来源矩阵中无 A 类许可；真实导入公告 0、活动 0。当前产品只提供核实官网入口。 |
| GitHub Pages | 待本轮部署复核 | 后续在 [最终报告](phase-2c-final-report.md)记录实际 Actions 运行和线上访问结果。 |

截图：[375px 官网来源](screenshots/phase-2c-official-375.png)、[1440px 官网来源](screenshots/phase-2c-official-1440.png)、[375px 日历](screenshots/phase-2c-calendar-375.png)。截图取自本地实际渲染，不代表官网数据同步。
