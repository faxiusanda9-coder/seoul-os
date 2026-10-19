# TikTok 免费额度内的自动更新

根据维护者最新指示，本阶段获准合并、发布和使用已提供的密钥执行真实请求。旧指南中“本轮不得部署/请求”的限制仅描述当时的离线交付。

生产采集范围仍为 TWICE、Stray Kids、NMIXX、NEXZ、ITZY、NiziU。每个账号每轮最多 8 条，每天北京时间 08:00、20:00（`0 0,12 * * *`）；GitHub 定时运行可能延迟。网站沿用原 Pages 部署，不改变其他平台计划。

## 已核实的规则

- [Bright Data 免费层文档](https://docs.brightdata.com/general/account/billing-and-pricing/free-tier)说明：Scraper API 每条交付记录消耗 1 credit；符合条件的新账户每月获得 5,000 credits。免费额度优先，无充值资金的账户额度耗尽后停止。另有代理产品专用的一次性 $2 试用额度。
- [账户 API 文档](https://docs.brightdata.com/api-reference/account-management-api/Get_total_balance_through_API)说明：没有免费 credits 或自动充值状态的查询 API；自动充值要求已验证的支付方式。
- 维护者已报告剩余 3,441/5,000 credits、Balance $2、没有支付方式且无法付款。保留 Balance=2、来源未知、现金支出未知、自动充值观察未知，不把这些未知值填成 0/false。现有密钥可以访问采集接口，但账户余额接口返回 403；不以此要求维护者重复提供账单。

## 配置和保护

- `BRIGHT_DATA_API_KEY`、`BRIGHTDATA_ZERO_COST_APPROVAL_JSON` 只放 Actions Secrets。
- `BRIGHTDATA_TIKTOK_ENABLED=true` 允许 API 使用；独立的 `BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED=true` 才允许正式同步。缺失或其他值默认关闭。手动默认模式仍是 plan。
- V2 授权中的 `noPaymentMethodReported=true` 配合 `paymentMethod=none-reported` 和有出处的免费专用授权，可用于计划任务；不伪造 `autoRecharge=false` 的控制台观察。
- 从维护者报告的 3,441 credits 中额外保留 441 credits，当前月项目可用上限 3,000，仍受每月 4,000 条内部硬上限约束。每次请求之前先向 `automation/brightdata-budget` 分支持久化预留。错误、重复读取和不确定结果均不退还预留。
- 只有显式 `recurringMonthlyFreeTier=true`、`monthlyFreeTierEvidenceRef` 指向上述官方免费层文档、无支付方式报告及 scheduled-free-only 授权同时存在，才按文档在下个月使用新的 5,000 credits 预算起点。该数值标为公开规则推算，绝不称为实时账户余额；原 3,441/$2 的观察及时间继续保留。新月份不能清除未解决任务，原始历史账本完整保留。
- 免费 credits 是账户共享额度。项目本地上限不代表供应商账单；不购买套餐、不充值、不启用自动充值，供应商报错或未解决任务会停止后续采集。账户新增其他消费或改成付费方案时，应关闭本项目定时开关。
- 已知 Snapshot 的超时只允许继续查询该 Snapshot，不能重新 POST。首轮真实 TWICE 8 条任务耗时约 9 分 49 秒，因此 Profile discovery 最长等待 30 分钟，六账号串行工作流最长 195 分钟；失败和未知任务保留记录并停止。放宽等待不增加每次返回上限，也不增加 POST 次数。
- 采集成功、数据入库、网站部署、实际播放、实际账单核验分别记录；账户 API 没有提供的实际额度变化及现金支出继续为 unknown，不把工作流成功称为账单核验。

## 启用顺序

1. 定时关闭时合并代码，原 Pages 工作流发布已有 80 条视频。
2. 默认分支手动 probe：仅 ITZY、最多 1 条，先预留后 POST，不写公开视频。
3. 验证真实 Snapshot 和作者/视频 ID/时间。若请求已提交但等待超时，继续检查同一任务，不重复探测。
4. 根据维护者已明确提出的每日更新要求，配置 scheduled-free-only 授权，关闭首次初始化开关，最后开启独立定时开关，并手动 sync 一次核对真实链路。
5. 用实际 Actions 报告、生产 JSON 和 Pages 部署结果验收。没有新增时仍记录成功检查时间，不重复新增旧视频。

原记录和收藏 ID 保留。播放仍使用 TikTok 官方单条 Embed Player，仅存稳定帖子链接和必要公开元数据；不下载或重新托管视频。

## 真实发布后的测试数据隔离

首轮真实采集后，发布前检查发现部分测试把生产账本复制进测试场景，再假设账本为空，导致 11 项断言失败而没有发布。这与额度不足无关。四组 Bright Data 测试现只在独立临时目录初始化受控状态和预算，不读取生产的已用额度作为测试起点；生产账本不删除、不重置。初始化器拒绝生产路径。原 35+45=80 的历史导入仍精确核验 57/45/12/3、完整原始字段及全部 ID；同时允许生产继续新增记录，逐条校验完整生产 Schema 和唯一性。

使用真实的 25 条远端预留、真实失败状态以及额外一条仅在临时目录的受控测试记录进行了回放，相关 54 项通过、生产文件未修改、供应商请求为 0。只因本次真实发布失败才重跑受影响的用例，没有删除测试或放宽数据校验。

NEXZ 真实任务曾在最终 ready 前返回未识别状态，随后同一个 Snapshot 已 ready、8 条可读取。官方状态文档仅列出 starting/running/ready/failed，因此不编造新的成功状态：遇到未知状态最多用一分钟复查同一任务；只有之后返回同 ID/同 Dataset 的 ready 才下载。持续未知、身份不符仍停止，预算不退还，不重复 POST。真实调度事件、这次恢复和新的手动整轮分开记录。
