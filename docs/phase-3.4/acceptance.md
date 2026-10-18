# SEOUL.OS Phase 3.4：分支整合与 TikTok 自动采集验收

日期：2026-10-18（北京时间）。本轮用户明确确认：**尚未配置密钥，先完成整合和测试。** 因此不发送真实采集请求，不申请正式启用、不合并 PR、不部署生产。

## 阶段状态必须分开

| 阶段 | 本轮结论 |
| --- | --- |
| 本地导入 | 已整合；原 35 条 + 45 条新增 = 80 个唯一 ID；57 条通过验证，12 条匹配旧记录只补证据，3 条失败行拒收 |
| 离线真实导出验证 | 重新读取用户原始下载文件完成；公开只保存必要字段的白名单样本与原文件 SHA-256 |
| 真实 API 验证 | **未通过/未进行**：GitHub Secret 未配置，未发送采集请求；本地文件和模拟响应不能代替此项 |
| 定时配置 | 开发分支已配置 `0 0,12 * * *`；默认六团、每账号最多 8 条 |
| 定时实际运行 | 未运行；未进入默认分支、未开通授权与预算条件 |
| 线上部署 | 本轮未部署；不能把本地 80 条称为线上已更新 |

## 1. 审查与整合证据

先生成 [分支差异清单](branch-differences.md) 与 [文件指纹审计](pre-integration-audit.json)，再修改代码。`feat/tiktok-json-import` 位于另一个本地仓库，四个成果文件均未提交；其 HEAD 与原 PR #3 都是 cfa0e7e，但不能据此当作工作区改动已互相包含。

本轮只读复制四个文件，保留源工作区全部未提交改动；将最新 `origin/main` 的同步状态/YouTube 更新合入开发分支，未覆盖其他平台的数据。

来源及处理结果：

- [原本地报告](original-local-import-report.md) 和 [原 JSON 报告](original-local-import-report.json) 原样保留。旧 JSON 把 12 条记录列为 updated；依据当前导入代码及字段复核，实际是 **0 条内容更新、12 条补充证据**。没有篡改原报告来隐藏这一差异。
- [重新验证结果](import-revalidation.json)：实际导出 60 行 → 有效 57 → 新增 45 / 内容更新 0 / 补证据 12 / 失败 3。包含每个账号的原始采集时间和最新发布时间。
- [脱敏真实字段样本](sd_mvdx30v5inbop8r5r.json) 保留 ID、账号、主页、原帖、时间和错误码，未保存签名媒体 URL、正文、Cookie、CDN 地址或临时令牌。
- [原 35 条字段指纹](baseline35-hashes.json)：自动测试确认每条原记录、原 ID 和原字段不变；57 个有效导入 ID 全部存在，80 个 ID 不重复。
- [3 条失败证据](local-import-failures.json) 独立保存。ITZY 失败 ID 未进入列表；TWICE/Stray Kids 的两个失败 ID 原本已有人工核验记录，保留原记录，**未附本次失败快照证明**。单次 dead_page/timeout 不等于帖子已删除。

## 2. 六团自动范围

`data/providers/tiktok-auto-scope.json` 只保存六个 artistId，不编造 URL；运行时从 `data/social/accounts.json` 取 verified 映射，缺失、重复、未核验或配置不一致就拒绝运行。

| 艺人 | 已核实 handle |
| --- | --- |
| TWICE | twice_tiktok_official |
| Stray Kids | jypestraykids |
| NMIXX | nmixx_official |
| NEXZ | nexz_official |
| ITZY | itzyofficial |
| NiziU | niziu_official |

BOY STORY/GIRLSET 历史卡片和官方入口继续可用，明确显示未纳入本轮 Bright Data 自动采集。

30 天设计返回上界：6 × 8 × 2 × 30 = **2,880 条**；31 天为 2,976 条。它们是返回量设计估算，**不是免费额度或实际账单承诺**。每次读取旧视频照样预留额度。

## 3. 真实请求链路及字段

沿用已核实的 TikTok Posts 数据集 `gd_lu702nij2f790tmv9h`、`discover_by=profile_url`：trigger → snapshot ID → bounded progress polling → JSON snapshot → 校验 → 去重 → 增量。

字段依据为用户的实际导出文件，不能只按宣传字段名推断：`profile_username` 实际是显示名（例如 ITZY），**`account_id` 才用于匹配 handle**。新记录必须同时匹配 account_id、profile_url 和原帖 URL 中的账号；显示名不能用来认领官方身份。关键身份字段缺失、错误/非视频行、非法 ID/域名/日期、未来异常日期或超出返回限制时拒收。

| 保存字段 | 来源/规则 |
| --- | --- |
| id | `tt-<post_id>`，字符串处理，不经过浮点数转换 |
| sourceUrl / embedUrl | 允许域名的原帖规范链接；仅 `/player/v1/<post_id>` 官方单条播放器 |
| publishedAt | 原始 create_time，保留时区；不推测缺失时间 |
| thirdPartyEvidence | provider、datasetId、snapshotId、作者、原帖、原始发布时间、官方账号证据及实际获取/核对时间 |
| acquisitionMethod / verificationStatus | third-party-api / account-matched，不冒充 Display API 或人工核验 |

自动同步使用 append-only 合并：只有新增合格 ID 才修改 `data/social/tiktok/items.json`。旧视频重复读取不更新观察时间到内容文件，不覆盖人工标题、未知发布时间、旧来源或删除/播放证据。0 新增仍更新独立成功检查状态。

仅含必要 ID/链接/日期的第三方历史索引不再因任意 30 天阈值消失；官方 API 原保留期逻辑不变。**这不是许可授予**：开通前必须确认实际索引、保留和公开展示条件；已确认删除/权利人移除继续使用既有移除流程。供应商失败不会把源内容或播放器标为已删除。

## 4. 预算与安全

- 所有真实采集使用 Actions Secret **`BRIGHT_DATA_API_KEY`**。旧 `BRIGHTDATA_API_TOKEN` 不再被执行器接受；不会输出密钥或 Authorization。
- 内部硬上限 **4,000 条/月**，额外付费上限 **$0**。账户免费资格、剩余额度、无充值/自动充值、供应商免费硬停止与用途许可必须有证据；默认全部未确认，密钥单独存在也不足以开通。
- 供应商实际账单、实际返回数量、本地保守预留分开：`paidSpendUsd=null`，从未伪填成已确认花费 0；导出文件和本地预留不能证明用户余额或实际账单。
- 统一远端预算分支 **`automation/brightdata-budget`**，文件 `ledger.json`。PR 单条 probe 与未来 main 定时任务读同一台账，不能各自获得一份额度。首建需要显式初始化开关，缺失/损坏不自动清零恢复。
- 在 POST 前先将预留保存并推送成功，之后才调用供应商。Git fast-forward 冲突会拒绝第二个写入者，**不 force、不自动重放 POST**。并发工作流同时使用 social-manifests 锁；本地还有文件锁。
- 后续保存 snapshot ID 和终态；未知任务保持预留，拦截继续采集；不自动退费、不升级、不自动充值。API 错误/未就绪超时/身份异常等停止本轮剩余账号，保留旧内容。
- 每次保存脱敏运行报告：是否尝试请求、供应商是否返回任务、Snapshot、结果是否下载、实际返回数、作者验证、最新发布时间、本地写入数、预算和失败原因。`billingVerified=false`、`playerPlaybackVerified=false` 在没有独立证据时保持未确认。

## 5. 工作流和部署

`.github/workflows/brightdata-tiktok.yml`：北京时间 08:00/20:00；正式 schedule 只在默认分支生效。手动默认 plan；sync 遵循同样的六团范围、预算、身份和数据校验。

解决“先实测才能合并，但新 workflow_dispatch 尚未注册在默认分支”的问题：同仓库 PR #3 可由维护者手动添加 `brightdata-probe` 标签，仅执行 ITZY 1 条 probe。它不走 pull_request_target、不接受 fork、不发布生产；仍使用共享预算和同样许可拦截。标签本身不能绕过 $0 保护，当前没有配置密钥/额度，**本轮没有触发真实 probe**。

未来 main 同步有新内容/有效状态变化时，复用既有 `deploy.yml`；所有生产发布步骤同时要求 main 和 sync 模式，probe 无发布输出。预算分支没有站点代码，不会触发 Pages；没有新增另一套部署流程。

原 `youtube-sync.yml`、Instagram/Display API 的 `social-sync.yml`、`calendar-sync.yml`、`deploy.yml` 内容不改。搜索、筛选、localStorage 收藏键及全局播放器事件逻辑保留。

## 6. 验证与复现

```powershell
npm ci
node --test tests/*.test.mjs
npm run check
npm run build
npm run import:brightdata:tiktok -- --file=docs/phase-3.4/sd_mvdx30v5inbop8r5r.json
npm run sync:brightdata:tiktok -- --mode=plan
npm run sync:brightdata:tiktok -- --mode=probe --artist=itzy --limit=1
```

当前最后两条预期因 Key 缺失退出 1；实际采集请求数 0，不能作为 API 成功。传入真实密钥的 live 模式仅允许 Actions，并要求远端持久化台账；不把 Token 放到本机命令或聊天。

浏览器工程回归单独启动本地 5182 服务，再设置 `$env:BASE_URL='http://localhost:5182/seoul-os/'`，执行 `test:social:ui`、`test:discovery:ui`、`test:brightdata:ui`。测试夹具只在临时目录，不能代替真实 API/账单/视频播放。关闭播放器的已有键盘路径继续回归，真实触摸不冒充已验证。

测试、实际播放器样本、提交与 CI 结果见最终交付记录。只有取得密钥和可核实的账户/使用条件后，才进行单账号真实 API 验证；通过后再申请上线。

## 本轮实际验证结果

- 完整自动化测试 **99/99 通过**；TypeScript 检查、生产构建和 git diff --check 通过。构建保留现有大于 500 kB 的非阻断分包提示。
- 浏览器工程回归 **21 组通过**：社交媒体 11、发现同步 5、Bright Data 集成 5。各自报告保存在本目录；包含收藏/刷新/Archive、搜索筛选、官方播放器同意与回退、YouTube/Instagram 回归及 375/390/412px 布局。
- 真实播放器样本：NEXZ **tt-7697867251575311668**，官方单条播放器，390px，本地站内实际播放。检测到 currentTime=0.522449、readyState=4、paused=false；原帖与账号入口保留、关闭正常、无横向溢出。见 [真实播放记录](tiktok-tt-7697867251575311668.json)。**该项不是 Bright Data API 实测，也不证明其他视频均可播放。**
- 缺少密钥的 ITZY 1 条 probe 安全停止：requests=0、contentWrites=0、connected=false；未建立真实远端预算分支，未实际计费、未修改生产数据。
- [最终保护性核验](final-verification.json) 确认另一导入工作区四个文件 SHA-256 与审计前一致；原其他平台工作流、数据和官方账号映射与最新 main 一致。
- 原始请求格式再次对照供应商 [异步 API 官方文档](https://docs.brightdata.com/api-reference/rest-api/scraper/asynchronous-requests)：支持 input 包装和 body.limit_per_input，并用 limit_multiple_results 限总量；这只证明文档契约，不代表本账户请求、许可或免费资格已确认。

**尚需后续条件：**配置 BRIGHT_DATA_API_KEY、可核实的账户额度/$0 硬停止和索引用途许可，完成 ITZY 单账号真实 API 与账单核验，再申请正式启用。当前草稿 PR 不合并、不部署；定时任务已配置但未实际运行。
