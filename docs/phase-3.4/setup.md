# Phase 3.4 开通与维护（启动说明已更新）

当前执行入口以 [Phase 3.4.1 三阶段指南](../phase-3.4.1/acceptance.md) 为准。原“合并前加标签探测”已删除；默认关闭的代码可以先审查合并/发布，再从默认分支手动探测。以下保留账户及预算维护要求。

现状：先整合和测试；没有配置密钥，没有真实采集或正式调度/部署。以前的手动导出不是本系统实时 API 验证。

## 开通前材料

在 Bright Data 控制台确认真实剩余额度、适用计费单位、是否属于免费方案、充值余额为零、关闭自动充值、免费耗尽硬停止和公开最小索引/保留用途许可。不要充值或升级来通过测试；无法确认即暂停。手动导出已消耗的额度也要计入控制台剩余量，不能因本地台账为空便当作拥有全部免费额度。

仓库设置：

| 类型 | 名称 | 含义 |
| --- | --- | --- |
| Secret | BRIGHT_DATA_API_KEY | 唯一实际采集密钥来源 |
| Secret | BRIGHTDATA_ZERO_COST_APPROVAL_JSON | 私密余额/免费硬停止/用途证据，参考现有 JSON 模板，默认未批准 |
| Variable | BRIGHTDATA_TIKTOK_ENABLED | 核实条件后才设置 true |
| Variable | BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED | 独立定时/同步开关；缺失或不是精确 true 时关闭；手动 probe 不要求开启 |
| Variable | BRIGHTDATA_BUDGET_INITIALIZE | 仅首次建立共享预算分支时设 true；首次完成后改 false，禁止删除台账后重建绕过额度 |

确认 JSON 的 accountRef 必须稳定；month 为本月 UTC 月份；freeCreditsRemaining 是控制台真实剩余额度；baselineReservedRecords 是核实当时该账户已预留的项目条数。expiresAt 不晚于下月首日；不是填入想要的免费数量。用途证据必须覆盖索引和保留，不能仅勾选布尔值。

## 合并后的手动真实验证

保持定时开关关闭，由维护者审查合并/发布后，在 Actions 中选择此工作流、默认分支和 probe 模式，触发一次 **ITZY 最多 1 条**检查。PR 标签不再触发。首次按上述方式允许创建 `automation/brightdata-budget`；同一账号每日 probe 槽位防重放，未知任务必须先核实。

probe 完成后维护者检查 Actions 脱敏摘要：requestSent、taskSubmitted、snapshotIds、resultDownloaded、returnedCount、authorValidated、newestPublishedAt、预算和 contentWrites。probe 不导入生产内容、不更新公开成功时间、不调用 Pages。账单仍以控制台为准，代码不会伪造 billingVerified=true。

人工核对作者 @itzyofficial、原帖、发布时间和返回范围，并检查官方播放器；仅 iframe 加载或供应商返回成功不够。真实样本、实际账单、账户零付费依据和用途条件都通过并获维护者明确批准后，才开启定时采集。

## 正式运行

只有 `BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED` 设为精确字符串 `true` 后，默认分支 cron `0 0,12 * * *` 才能在每日北京 08:00/20:00 请求采集。仅 TWICE、Stray Kids、NMIXX、NEXZ、ITZY、NiziU，每轮每账号最多 8 条。30 天 2,880 条为设计估算，不是实际计费承诺。

手动 workflow_dispatch 默认 plan；probe 仍限 ITZY 1 条。probe/sync 必须选择默认分支；sync 也受独立定时开关控制，禁止用手动 sync 绕过正式批准。其他分支只可离线 plan，不能进行真实采集或发布。GitHub 定时任务可能延迟；最新 8 条窗口无法保证覆盖高频发布的所有历史内容。

0 新增时，只记录检查时间、预算和报告，不改写视频清单。原有帖子/收藏 ID 不变；历史最小索引不因一次失败或任意年龄消失，删除/权利人请求单独处理。原其他平台调度保持不变。

## 失败恢复

未完成任务、超时或未知是否收费时，不退还预留，不重复 POST。查看共享分支 ledger.json 的 Snapshot，在供应商控制台核实真实终态和账单。只有有可靠证据后维护者才可修复状态；保留原 limit 和历史消耗，禁止删历史、force 覆盖或清空数组。

CENTRAL_BUDGET_PERSIST_OR_CONFLICT 表示预算未能可靠落地，程序停止；不能跳过预算重跑采集。若远端已有保留，后续任务将继续拒绝请求，直至核实完成。账户变化、额度不明、用途许可到期应关闭启用开关。每月重新核对控制台额度与有效期，不按旧广告推定新的免费额度。
