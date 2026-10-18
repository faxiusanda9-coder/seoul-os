# SEOUL.OS Phase 3.4.2：一次探测与正式开通操作

2026-10-19，北京时间。PR #3 / feat/brightdata-tiktok。本轮只更新 PR 和操作流程，不合并、不发布、不配置或读取真实密钥、不调用 Bright Data。本轮没有重跑原 113 项离线测试；仅验证新增逻辑，记录见 [implementation.md](implementation.md)。

## 现在点击什么

1. 打开 [Bright Data Billing Settings](https://brightdata.com/cp/billing/settings)，保持无 Payment method，不充值、不购买套餐；如果 Auto-recharge 已开启，将其关闭。如果状态尚未知，记录 null，不填 false。
2. **费用方面只剩一个缺口**：找到能保证本次请求“只扣免费 credits、不扣 $2 Balance、不产生现金账单、不触发自动充值”的服务端限制或客服书面确认。不要用本地 1 条上限替代供应商计费保证，也不要为获得保证而充值。

可以直接把下面这段发给 Bright Data 客服；本工具不会代发：

> 我的账户显示剩余免费 credits 3,441/5,000、Balance $2，未添加 Payment method。计划仅对 TikTok Posts 数据集 gd_lu702nij2f790tmv9h，discover_by=profile_url，采集 @itzyofficial，num_of_posts=1、limit_per_input=1、limit_multiple_results=1。请确认该请求适用免费额度、最多扣多少 credits，以及可通过什么服务端限制保证绝不扣 Balance、不产生现金/后付费账单或触发自动充值；若无此限制，请明确说明。

没有这个保证就停在此处，不运行 probe。已有 credits、Balance 和支付方式信息已保留，不再反复索要；无需先判断 $2 属于赠送还是充值。

依据：[Bright Data TikTok 官方 FAQ](https://brightdata.com/products/web-scraper/tiktok) 说明 5,000 免费 credits 和无信用卡起用，但免费额度耗尽后有预存资金可转为按量计费。公开说明没有证明本账户的 $2 性质，也没有提供本请求禁止余额/现金扣费的特定开关。不要凭空寻找一个被我们编造的“$0 按钮”；找不到限制时，问上述一个问题即可。

## GitHub 需要设置什么

在 [仓库 Settings → Secrets and variables → Actions](https://github.com/faxiusanda9-coder/seoul-os/settings/secrets/actions) 设置。**当前只需保持关闭；下列真实凭据与授权设置由维护者以后操作，本轮未执行。**

| 位置 | 名称 | 初次探测前的值 |
| --- | --- | --- |
| Variables | BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED | `false` 或保持不存在，probe/reconcile 期间都不改 |
| Variables | BRIGHTDATA_TIKTOK_ENABLED | 准备单条探测时才设 `true`，表示允许 API 使用，不代表启用定时 |
| Secrets | BRIGHT_DATA_API_KEY | 使用重新生成的有效 Key；不要沿用聊天中暴露的 Key，不放源码/命令/报告 |
| Secrets | BRIGHTDATA_ZERO_COST_APPROVAL_JSON | 从 [V2 模板](../../data/providers/brightdata-zero-cost-v2.example.json) 填写，不能照抄示例作为已核验证据 |
| Variables | BRIGHTDATA_BUDGET_INITIALIZE | 仅真正首次创建共享预算分支时 `true`；首次 probe 结束即改回 `false`。已有/曾有账本不得删除重建 |

V2 模板已经保留你的数值：freeCredits.remaining=3441、total=5000；balance.amountUsd=2、kind=unknown；paymentMethod=none-reported。cashSpend.amountUsd=null、autoRecharge=null 均保持未知，不自动写 0/false。这四项分别代表免费计量、可见账户余额、已知现金支出和自动充值状态；余额不是现金支出的同义词。

模板还要填写：当前 UTC 月 month、真实复核时间 confirmedAt、有效期 expiresAt（不得跨下月，单条探测建议短有效期）、稳定私密 accountRef；暂停其他采集后确认 accountExclusive；明确批准最小元数据/官方播放器用途并保存 permissionEvidenceRef。授权中的 approved 和四个 Confirmed 字段只能在上述供应商保证真实存在时改为 true，填入 evidenceRef 以及其给出的 maxCreditsPerRecord。scope 保持 **itzy-probe-once**。我们不猜测 1 record 恒等于 1 credit。

baselineReservedCredits 与 baselineLegacyReservedRecords 只按已有远端台账填写；真正首次且账本为空时两者为 0。它们是本地保守预留基线，不是供应商账单。旧 V1 仍兼容，但不适用于“$2 Balance 来源未知”的新路径；无需把未知余额冒填为 depositedBalanceUsd=0。

## 代码如何进入默认分支并部署

工作流必须先进入默认分支，手动 Run workflow 才有可靠入口，见 [GitHub 官方说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)。本轮没有执行合并或部署。

维护者决定发布代码后：先保持定时变量 false → 打开 [PR #3](https://github.com/faxiusanda9-coder/seoul-os/pull/3) → Ready for review → 审查 → Merge pull request → Confirm merge。**合并 main 会自动触发原有 GitHub Pages 部署**，发布当前代码及 80 个视频；这一步会部署网站，但采集仍关闭。确认该发布已完成后再做下面的 probe，不通过 PR 标签或重复 CI 来启动。

## 真实测试如何启动（最多一次 POST）

1. 满足唯一费用保证和上面 GitHub 设置后，进入仓库 **Actions → Check TikTok profiles via Bright Data → Run workflow**。
2. Branch 选 **main**，mode 选 **probe**；其余两个输入留空。只点一次 Run workflow。
3. 脚本在发送 HTTP 前校验 Secret、API 使用许可、授权作用域、默认分支、信用预留和历史任务；预留必须已推送到共享 automation/brightdata-budget。Git 冲突、未知 Snapshot 或曾预留过 ITZY probe 均不会再次 POST，跨天重跑也不行。
4. 本次最多 ITZY 1 条，不写生产视频、不改公开成功时间、不调用 Pages。不要因失败而重跑或清空预算；把失败报告留给维护者排查。

在该 Actions 运行页面下载 **brightdata-tiktok-summary**（保留 7 天，请及时保存并核对）。报告包括 requests、liveValidation.requestSent、snapshotIds、returnedCount、authorValidated、newestPublishedAt、preview 中真实 ID/原帖，以及 accounting.before、probeReservedCredits。作者必须为 itzyofficial、返回恰好 1 条、内容写入 0；任务 ready 和 iframe onLoad 不能替代真实视频播放验证。

API 不提供可靠账户账单读数时，accounting.after、实际额度变化、实际现金支出保持 null，billingVerified=false；不会因为请求成功就填写现金支出 0。

## 测试后一次核对，不再采集

只核对本次请求一次：打开 Bright Data 控制台，记录之后的免费 credits、Balance 和该 Snapshot 的实际现金账单。未知现金支出仍为 null；账单未确认则 pending，停在此处，不启动定时、不重复发请求。

回到同一 GitHub 工作流 **Run workflow → main → mode=reconcile**：

- probe_run_id：前一次 probe 的 Actions URL 中 `/actions/runs/` 后的数字。
- account_after_json：按下方结构填本次实际观察；null 项必须由实际数据替换，不能用示例伪造结果。snapshotId 从 probe 报告复制；cashSpendUsd 是这次 Snapshot 的现金支出，不是 $2 Balance，也不是账户历史总支出。没有依据就保留 null/pending。

```json
{
  "snapshotId": "REPLACE_FROM_PROBE_REPORT",
  "freeCreditsRemaining": null,
  "balanceUsd": null,
  "cashSpendUsd": null,
  "autoRecharge": null,
  "observedAt": "REPLACE_WITH_ACTUAL_ISO_TIME",
  "billingStatus": "pending",
  "evidenceRef": ""
}
```

明确有本次账单依据时，billingStatus 才可填 confirmed，并填私密核验记录的引用。不要在输入中放 Key、卡号、发票个人资料。填入 credits 与 Balance 实际数值后点 Run workflow。此模式只下载原 probe 报告，核对运行 ID、默认分支、Snapshot 和前后数值，不注入 Bright Data Key、不请求供应商、不修改预算、内容或仓库变量。

新的同名 artifact 包含实际 credits 消耗、Balance 变化及维护者确认的现金支出；仅在消耗未超预留、Balance 不减、现金支出明确为 0 且证据已确认时，billingVerified 才为 true，并注明来源为维护者核对，非供应商 API 自动验证。余额下降、收费、未知或核验不匹配一律不通过，不自动开启任何功能。

## 测试通过后如何开启每日两次

确认真实视频/作者/时间、Snapshot、预算、reconcile 零额外费用均通过，由维护者明确批准持续运行后：

1. 更新同一个 BRIGHTDATA_ZERO_COST_APPROVAL_JSON：scope 改为 **scheduled-free-only**，使用覆盖本月六团持续请求的免费专用保证；freeCredits.remaining 填核对后的实际余额；baselineReservedCredits 从 probe 报告 accounting.reservedCredits 抄录，legacy 基线按远端账本，不删历史；复核有效期，autoRecharge 必须明确为 false。
2. 保持 BRIGHTDATA_TIKTOK_ENABLED=true，把 **BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED 改为 true**。单次授权不能直接扩展到定时，缺少持续保证则继续关闭。
3. 此后 cron `0 0,12 * * *` 在北京 **08:00 / 20:00** 检查 TWICE、Stray Kids、NMIXX、NEXZ、ITZY、NiziU，每团最多 8 条；合格新 ID 增量更新并复用既有 Pages 发布。GitHub 调度可能延迟。月内部上限 4,000 records 与免费 credits 预留分开，不自动充值/购买套餐。

若需要停止，把定时变量改回 false；历史 Snapshot、credits 预留和视频不删除。本轮没有执行上述任何真实请求、合并、发布或开通操作。
