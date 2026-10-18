# SEOUL.OS Phase 3.4.1：Bright Data 启动架构修复

> 当前费用模型与实际操作入口已更新至 [Phase 3.4.2](../phase-3.4.2/operations.md)：V2 分开记录 credits / Balance / 现金 / 自动充值，unknown $2 不冒填 0，也不再重复要求整套账单材料。下文保留历史验收；请勿继续按旧 V1 清单反复检查。

日期：2026-10-19，北京时间。工作分支 `feat/brightdata-tiktok`，PR #3；启动修复基线 `5021bcbe5777e11983e5222838c1ee9f4cfbb1d9`，本次离线补充基线 `3acdd8aaeee0aa2f8c66099fa3a41caa2124f1e6`，默认分支基线 `42b260763711be7d31b523bec2b0f23bf042e988`。用户最新要求明确恢复为**只修改代码和离线测试，不合并、不部署、不配置/读取真实密钥、不请求真实 API、不产生付费操作**。所有 API 流程测试均使用明确标注的受控假凭据和模拟响应。

用户报告账户显示免费额度 **3,441/5,000、Balance $2、无支付方式**。这些属于用户提供的控制台观察，尚未独立核实；不能自动作为零付费授权，也没有据此填写真实 approval、更新预算或启用开关。待控制台确认事项见本文末尾。

## 1. 触发机制诊断

本轮 `git cat-file -e origin/main:.github/workflows/brightdata-tiktok.yml` 返回文件不存在；PR #3 仍为未合并草稿。不能把普通 PR CI 通过当成采集工作流已注册、已手动执行或已定时运行。

- [GitHub 手动运行官方说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)：workflow_dispatch 需要工作流位于默认分支，之后维护者可在 Actions 选择分支和模式。
- [GitHub 事件官方说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)：schedule 仅在默认分支运行，且可能延迟。
- [pull_request 官方规则](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)：支持 labeled 活动类型，运行于 PR merge ref；不能笼统说所有 labeled 都要求工作流在默认分支。原设计仅监听 labeled，因此普通 synchronize/CI 重跑并不执行探测；本仓库此前也没有已执行标签探测的证据。新设计完全删除 PR 标签采集入口，避免把它作为合并前携带凭据运行 PR 代码的启动机制。
- 未增加 pull_request_target。无需重复贴标签、重跑 CI或修改默认分支以绕过触发条件。

原先“真实探测成功才可合并”和“手动入口需先在默认分支注册”形成启动依赖冲突。现在将代码发布与采集启用分成独立阶段。

## 2. 修改文件及行为

| 文件 | 变化 |
| --- | --- |
| `.github/workflows/brightdata-tiktok.yml` | 删除 PR labeled 触发，只保留 cron 和 workflow_dispatch；默认 plan；新增无密钥启动门禁；只有允许执行的 live 步骤可接收 Secrets；probe 永不提交生产内容或调用 Pages |
| `scripts/brightdata-tiktok/launch.mjs` | 纯离线路由及脱敏报告；检查事件、默认分支、模式和独立定时开关；禁用时只写 test-results 报告与 Actions Summary |
| `scripts/brightdata-tiktok/sync.mjs` | 核心 sync 在读 data、加锁、远端台账操作前检查开关；CLI live 限 Actions/默认分支/持久化预算；plan 只检查账号配置和本地预算镜像，不读取密钥或授权 JSON；生成计划退出 0，但 connected=false，不标成 API 成功 |
| `.env.example` | 加入 `BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED=false` 示例，不含真实凭据 |
| `tests/phase341-launch.test.mjs` | 新增关闭状态零副作用、触发矩阵、实际 CLI、受控单条探测、许可/预算/未知 Snapshot 的回归 |
| `tests/brightdata-tiktok.test.mjs`、`tests/phase34-tiktok.test.mjs` | 有意模拟已启用 sync 的夹具显式设置新开关；工作流断言改为无标签入口并校验默认分支保护；原测试保留 |
| `scripts/test-brightdata-ui.mjs`、`scripts/test-social-ui.mjs` | 隔离的模拟同步夹具显式开关为 true；生产构建回归发现旧断言早于频道加载及 iframe 导航，改为等到 50 条频道链接和目标 frame 内按钮出现再继续；不改生产数据或播放器 |
| `README.md`、`docs/phase-3.4/{setup,acceptance}.md`、本报告 | 更新当前三阶段入口，明确废止旧标签操作，保留旧导入与失败证据 |

未修改任何生产数据：现有 80 个 TikTok 唯一 ID、人工核验、来源证据和收藏 ID 均保持。未改账号映射、前端播放器/收藏持久化，以及 YouTube、Instagram、Calendar 和 deploy 工作流。

## 3. 独立开关和默认行为

| 状态 | 结果 |
| --- | --- |
| schedule 或手动 sync；定时开关缺失、false、TRUE、带空白等 | `executionStatus=disabled`、`reason=SCHEDULE_NOT_ENABLED`、消息“定时采集尚未启用”；请求 0、内容写入 0；不读写远端预算，不修改公开时间 |
| workflow_dispatch 默认 plan | 离线验证六团配置、本地预算余量、未决任务和每轮 48 条预留需求；不读取密钥/授权、不查询远端，不采集、预留或发布；供应商额度与账单保持未知 |
| 默认分支手动 probe；定时开关关闭 | 允许进入原密钥、API 使用许可及零付费/预算检查；全部通过才能申请 ITZY 1 条 |
| 非默认分支 probe/sync | 拦截为 DEFAULT_BRANCH_REQUIRED，不注入执行步骤凭据、不发送请求 |
| 定时开关精确 true，但缺少 API 许可/密钥/有效预算或存在未知旧任务 | 原有保护继续拦截；开关不是许可证明 |

关闭时，GitHub 工作流可以以成功退出表示“安全跳过”，但脱敏报告明确为 disabled、connected=false、requestSent=false，不能算成功采集。公开数据和成功同步时间保留原值。checkout/setup 等 GitHub 基础操作不等于供应商请求。

## 4. A 阶段：安全审查、合并与代码发布（维护者后续操作）

1. 审查本 PR、完整测试和构建；确认只涉及上述文件及既有 Phase 3.4 成果。
2. 保持仓库变量 `BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED` 缺失或为字符串 `false`；API 使用变量也可保持关闭，不需要设置真实密钥来完成 A。
3. 维护者另行批准合并后，沿用现有 push main → deploy.yml 发布代码和 80 条清单。合并/网站发布不会自动代表采集启用；定时触发只记录“尚未启用”，不修改预算或成功时间。

本轮没有执行以上合并或部署。无需先调用 Bright Data 才能审查发布默认关闭的代码。

## 5. B 阶段：合并后手动 ITZY 单条真实探测（维护者后续操作）

准备仓库设置，不将凭据放进命令、仓库文件、公开报告或聊天：

| 类型 | 名称 | 要求 |
| --- | --- | --- |
| Secret | `BRIGHT_DATA_API_KEY` | 有效 Bright Data 凭据，仅 live 执行步骤接收 |
| Variable | `BRIGHTDATA_TIKTOK_ENABLED` | 明确为 `true`，只表示允许在证据核实后尝试 API，不启用定时 |
| Secret | `BRIGHTDATA_ZERO_COST_APPROVAL_JSON` | 使用[现有模板](../../data/providers/brightdata-zero-cost-approval.example.json)，真实账户、当前 UTC 月、有效期、剩余额度、无充值/自动充值、免费硬停止、用途证据都必须有效；不能照抄模拟值 |
| Variable | `BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED` | 继续保持缺失或 `false` |
| Variable | `BRIGHTDATA_BUDGET_INITIALIZE` | 只在真正首次建立共享远端台账时允许为 true；首次完成后关闭。已有或曾有台账不得通过删除重建绕过历史 |

确认实际免费额度扣除了其他手动导出/使用；本地 4000 上限不保证供应商免费，广告也不能代替账户证据。若无法证明免费耗尽硬停止或用途许可，保持关闭。

Actions → **Check TikTok profiles via Bright Data** → **Run workflow** → Branch 选择默认分支 main → mode 选择 **probe** → Run workflow。不要选择 sync，不用 PR 标签。

流程固定 `--mode=probe --artist=itzy --limit=1 --persist-git`：先检查预算 → 持久化并推送至共享 `automation/brightdata-budget:ledger.json` → POST → Snapshot ID → 有界轮询 → 下载 JSON → 作者/视频/日期校验。probe 不写生产视频或公开同步状态，不调用 Pages；预算预留及任务状态必须保存以防重复计费。

运行后检查 `brightdata-tiktok-summary` artifact，独立记录：

- `requests`/`liveValidation.requestSent`：是否真的请求供应商；不是 iframe 或 CI 请求数。
- `taskSubmitted`、`snapshotIds`、`resultDownloaded`、`returnedCount`：任务接收、终态、实际返回，不把 running 或未知状态当 ready。
- `authorValidated`、`preview[].authorHandle`（必须 itzyofficial）、原帖 URL 和 `newestPublishedAt`：逐项人工比对，不能只看界面卡片。
- 本地预留 1 条、供应商实际返回、供应商控制台实际扣费/额度变化分别核验。`paidSpendUsd=null`、`billingVerified=false` 保持未确认；控制台核实后在私密验收记录保存依据，程序不会把未确认账单伪填成 0 或自动批准 C。
- `contentWrites=0`；视频清单与公开状态不变；官方单条播放器另行实测，不用 iframe onLoad 冒充播放。

密钥缺失、API 未启用、证据不明/到期、额度不足或未知旧任务时在供应商 HTTP 请求前停止；远端预留冲突也先停，不重放 POST。失败保留旧数据和预留；不得删台账、退还不确定额度或反复提交。

## 6. C 阶段：正式启用六团每日两次（维护者后续操作）

只有 B 的 API、账号、发布时间、Snapshot、预算与实际零付费账单均通过，并由维护者明确批准后，才将仓库变量 `BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED` 设为精确字符串 `true`。API 使用许可开关保持 true，证据持续有效；程序不会因一次模拟/真实返回成功自动修改仓库变量。

默认分支 cron `0 0,12 * * *` = 北京每天 08:00 / 20:00。六团仅 TWICE、Stray Kids、NMIXX、NEXZ、ITZY、NiziU，每账号最多 8 条。30 天返回量设计上界 2,880 条，内部上限 4,000 条/月，额外付费上限 $0；供应商账单以实际控制台为准。

真实 sync 通过原身份校验和稳定 ID 去重，仅合格新 ID 写视频清单，0 新增仍更新独立成功检查状态；复用原 Pages 部署，不新增冲突部署。API 失败停止本轮后续账号、保留旧记录。关闭独立开关即可停止后续 sync（已发送的供应商任务仍须核实结算）；不能通过关闭开关抹掉未知任务或历史额度。

## 7. 验证与阶段状态

复现命令（无真实密钥）：

```powershell
node --test tests/*.test.mjs
npm run check
npm run build
node scripts/brightdata-tiktok/sync.mjs --mode=plan
node scripts/brightdata-tiktok/sync.mjs --mode=sync
```

最后一条默认返回 disabled，请求 0、文件不变。新增启动测试中的 API、账户、账单证据和远端回调均为模拟，真实 Git 台账并发测试仅操作隔离本地 bare 仓库。它们不能证明真实 API、真实许可、实际账单或正式调度已开通。

本轮实际结果与保护性文件指纹将随最终验证记录保存。阶段必须分开：代码/模拟测试完成不等于真实 API 验证；CI 通过不等于网站部署；网站部署不等于正式定时运行。

## 启动修复前次验收结果（提交 3acdd8a）

- **108/108 完整自动化测试通过**（新增 9 项启动测试），TypeScript、生产构建、格式检查与 git diff --check 通过。保留现有大于 500 kB 的非阻断分包提示。
- 生产构建预览 5183 上 **21 组浏览器回归通过**：社交 11、发现 5、Bright Data 5；报告保存在本目录。初跑暴露的两处等待竞态已修正，仍断言完整 50 条频道链接及目标 iframe 内控件。
- **7 份工作流通过 actionlint 1.7.12** 语法、表达式和工作流检查；工具来自上游 GitHub Release，并核对归档 SHA-256。未安装/运行 ShellCheck 或 pyflakes，不将其记为通过。
- [保护性核验与默认关闭结果](verification.json)：data/、src/ 和其他 6 份工作流与 5021bcb 完全一致；TikTok 80 个唯一 ID；视频、公开成功时间和预算文件 SHA-256 在关闭检查前后相同。
- **真实 API 未执行、账单未核验；本轮没有新的视频实际播放验收**。浏览器用受控嵌入壳验证同意、加载、失败回退、关闭、布局与收藏，不能冒充真实播放。Phase 3.4 的历史 NEXZ 播放证据不代表当前真实 API 已连接。
- **没有合并、没有部署生产、没有正式启用或实际运行定时采集，也没有配置/读取真实 Actions Secrets**。下一步仍须 A 的维护者审查合并、B 的账户与真实单条核验，最后才能明确批准 C。

## 8. 本次离线 plan 补充与账户确认清单

发现的问题：旧 plan 会调用真实请求的权限检查，首先因缺 Key 返回 TOKEN_MISSING，无法直观看到本地预算准备情况。现在独立检查配置及本地预算，完全不访问 env 中的密钥/授权字段，也不读取共享远端账本。Proxy 拒绝任何 env 读取的回归测试可证明此边界。

计划报告包括 configuration（六团、每团上限 8、cron）、budget.source=local-mirror、authoritative=false、reservedRecords、deliveredRecords、remainingInternalRecords、requestedRecords=48、unresolvedTaskCount。供应商余额 providerFreeCreditsRemaining=null、paidSpendUsd=null；liveReadiness 显示密钥/许可未检查、远端预算未读、canSendRequests=false。本地记录为空不意味着供应商没有历史用量或未完成任务。

本地未决任务或内部额度不足时，plan 显示对应 blocked 原因；不删除历史、不预留、不解析/解锁 Snapshot。计划成功只表示离线检查完成，不能证明 B 已通过。真实请求原有密钥、许可、有效期、共享预算预留、并发冲突和未知任务保护继续保留。

用户仍须在 Bright Data 控制台或向供应商核实并保存私密依据：

| 待确认项 | 必须弄清的问题 |
| --- | --- |
| 3,441 剩余额度 | 单位是记录、credits 还是请求？是否适用于本 TikTok Posts profile 数据集？重复、失败、最小计费量和任务超限如何计算？到期/重置周期是什么？不能把它直接认定为本项目可用 3,441 条 |
| Balance $2 | 是充值、赠送还是其他余额？免费额度耗尽后是否会自动扣它？当前代码要求 depositedBalanceUsd=0；未确认来源时为 null，会停止。若属于充值/可扣费余额，当前严格零付费路径不允许据此继续；不得为了通过校验填成 0 |
| 服务端免费硬停止 | 能否证明额度耗尽后采集会停止，且不会转到余额、按量计费、欠费或后付费？保存真实设置或供应商说明；没有支付方式不等于已经证明硬停止 |
| 自动充值/升级/支付 | 自动充值确实关闭，无自动升级、其他扣费方式或后付费约定；本项目不执行充值、升级或新增支付方式 |
| 其他任务和历史 Snapshot | 是否有手动导出、其他项目或尚未结算任务共享额度？本项目当前要求账户专用；开通时对账真实剩余额度、预算 baseline 和未知任务，禁止清空本地/远端账本来代替对账 |
| 使用许可 | Bright Data 合同与适用平台条件是否允许公开展示/保留最小元数据索引及原帖链接、使用官方播放器？供应商结果不代表 TikTok 官方 OAuth 授权，不下载或重托管视频 |

正式启用的必要条件：先由维护者批准在默认关闭时审查合并/发布 → 后续单独授权配置 Actions Secret 与真实有效的零付费/用途证据 → 共享远端账本可靠预留且无未知任务 → 默认分支手动 ITZY 1 条真实 probe → 核对实际响应、作者、时间、Snapshot 终态、实际额度/账单及播放器 → 获明确批准后才将定时变量设为 true。**本次不执行任何一项真实开通或付费操作。**

六团、8 条/团、北京 08:00/20:00、4,000 条/月内部上限与 $0 额外付费限制不变；80 条唯一视频及其他平台数据不变。本次测试结果和本地 plan 样本保存于 [离线补充核验](offline-verification.json)；之前的 108 项与 21 组浏览器记录保留为前次验收，不冒充本次新测试。

本次补充验收：**113/113 完整自动化测试通过**（新增 5 项 plan/额度回归）、TypeScript 检查、生产构建、7 份工作流 actionlint 和格式/diff 检查通过。构建仍有既有非阻断分包提示；本次未重复浏览器测试，也未调用平台播放器。实际本地结果见 [offline-plan.json](offline-plan.json)：六团、每团 8 条、本轮需求 48 条、本地镜像已预留 0 条、内部剩余空间 4,000 条；供应商实际额度和账单均未查询、保持 null。

本次实际生产数据/状态/预算写入 0，真实 Bright Data 请求 0；没有合并、部署、读取/配置真实密钥或产生付费操作。代码/模拟测试、真实 API、网站部署、正式定时运行继续分别记录，后三项均未完成。
