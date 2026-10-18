# Bright Data TikTok：安全开通步骤

现状：代码准备阶段，缺 Token，未真实接通，未合并/部署。不要把测试夹具当成账户授权或费用核验。

## 1. 核实账户与用途

使用专用于本项目的免费、未充值账户，确认没有其他产品共用额度，自动充值关闭，免费额度耗尽由供应商硬停止。不要充值、绑定付费方案或购买服务来完成试读。无法确认以上条件即停止。

在 Bright Data 控制台/客服核实：该账户免费资格、当前可用积分、计费单位、零付费限制；以及 TikTok Posts 数据集针对官方艺人账号最小公开元数据索引的许可与适用条款。保存私密凭证，不向仓库提交账户截图、账单或 Token。公共说明只记录已确认/未确认。

参考 [免费额度](https://docs.brightdata.com/general/account/billing-and-pricing/free-tier)、[MSA](https://brightdata.com/license)、[AUP](https://brightdata.com/acceptable-use-policy)。Bright Data 结果不是 TikTok OAuth 授权数据。

## 2. 只读准备与真实试读

`npm run sync:brightdata:tiktok -- --mode=plan` 为纯离线计划，永不请求 API。默认覆盖注册表中 8 个 verified TikTok 账号，每个最多 8 条。

私密配置使用 `.env`（已忽略）或当前进程环境：

- `BRIGHTDATA_API_TOKEN`：账户 Token，不使用 VITE 前缀。
- `BRIGHTDATA_TIKTOK_ENABLED=true`：只有证据核实后设置。
- `BRIGHTDATA_ZERO_COST_APPROVAL_JSON`：私密 JSON 字符串，结构参考 `data/providers/brightdata-zero-cost-approval.example.json`。

模板默认全部未确认，无法直接调用。填写项必须对应真实证据：`accountRef` 为稳定账户引用；`month` 为当月 UTC 月份；确认与过期时间为带时区 ISO 时间，过期时间不晚于下个月第一天；当月免费剩余量；独占、未充值、关闭自动充值、服务器免费硬停止和最小元数据公共用途许可。`baselineReservedRecords` 是核实余额时本项目**已经预留**的条数，不是任意增加额度的数。

首次真实试读仍在开发分支本地执行，最多 **ITZY 一条**：

```powershell
node --env-file=.env scripts/brightdata-tiktok/sync.mjs --mode=probe --artist=itzy --limit=1
```

probe 会产生实际供应商请求，仍消耗免费积分；会持久化 1 条预算预留，但不会写入内容清单或公开同步状态。不要发送 Token 到聊天，不要把带密钥命令存入历史。输出只有必要元数据，不保存完整供应商响应。

验证成功应满足：真实返回至少一条 `post_id` 字符串；URL、profile_username、profile_url 与 @itzyofficial 一致；create_time 是可靠的带时区发布时间；post_type 为 video。人工打开原始内容比对，确认是最新账号帖子且置顶没有挤占检查窗口。实际平台播放需另行检查，iframe onLoad 不能充当播放证据。

缺字段或异常返回时保留未连接结论；严禁自动追加不限量详情抓取或改用未核实参数。8 条是每轮窗口上限，不能承诺补齐短时间内超过 8 条的发布、全历史或删除同步。

## 3. 获准上线后配置 Actions

真实数据、费用和使用条件通过后，先取得用户上线确认，再合并。仓库 Actions 设置：

| 类型 | 名称 |
| --- | --- |
| Secret | `BRIGHTDATA_API_TOKEN` |
| Secret | `BRIGHTDATA_ZERO_COST_APPROVAL_JSON` |
| Variable | `BRIGHTDATA_TIKTOK_ENABLED=true` |

独立工作流 `brightdata-tiktok.yml` 的定时为 UTC `0 0,12 * * *`，北京时间每日 08:00/20:00。手动模式默认离线 plan；probe 限定 ITZY 1 条；sync 默认全 8 账号、每账号 8 条。开发分支 Actions 强制 plan，不能偷偷发出付费请求。不会改变原 YouTube/Instagram/日历时间。

预算 JSON 的**月上限 4,000** 不可提高。31 天最坏 3,968 条 + 一次 probe 1 条；同一账号/12 小时窗口只允许一次预留，工作流重跑不重复花额度。重读旧视频照样占用预算但新增计为 0。免费余额共享、未知或不足、许可到期/撤回时应停用，不启用自动充值兜底。

每月重新核实免费资格与额度，再更新私密确认；不要删除历史 ledger。界面展示的是本地保守预留，不是供应商实际账单；账单仍需在控制台核实。

## 4. 失败和不确定任务

- HTTP 错误、限流、异步超时或数据质量问题：停止本轮其余账号，保留原内容，查看脱敏摘要与独立状态。
- 不确定任务保持 reserved 并拦截后续调用。若 snapshotId 已知，在控制台核实它的终态；若为空，需要确认请求是否创建了任务，不能直接重试 POST。
- 只有取得供应商终态/账单证据后，由维护者审查更新该条 reservation 为 failed 或完整的 complete；**保留原 limit 和已预留量，不退款、不删历史**。无法确认则继续停用。
- 本地 `.lock` 是并发保护；异常退出后先确认没有其他活跃实例，再处理锁。不要运行多个数据目录/账户消费者绕过预算。
- 数据或状态损坏需从已知有效版本恢复，不把额度文件改成空数组。

超过项目 30 天保留期的第三方元数据在构建阶段移除；人工记录只移除过期第三方证据。原收藏只保留稳定 ID，继续沿用缺失占位逻辑。这个保留期不构成任何外部许可。
