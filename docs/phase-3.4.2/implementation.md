# Phase 3.4.2 变更记录

2026-10-19。基线 adcbb620315e4e5b557faf798d832286a5b758cb；仅功能分支与 PR #3，不合并、不部署、不使用真实凭据、不调用 Bright Data。用户操作以 [operations.md](operations.md) 为准，旧 3.4.1 账单清单保留为历史，不再作为重复询问入口。

- budget.mjs：保留 V1 兼容，新增 scoped V2。免费 credits、Balance、现金观察及自动充值分别校验；未知 Balance 性质/现金值不改成 0。只有提供支持来源的 free-only 保证才允许一次 ITZY probe，正式定时使用独立 scope。records 和 creditLimit 分开预留，旧无 creditLimit 记录需匹配基线。已有 probe 预留禁止跨天重新 POST；未知任务和并发冲突不退款。
- sync.mjs：传递明确的 mode/artist/limit 作用域，在请求前持久化记录及 credits 预留；报告保留账户 before，after 和费用默认未知，并记录 Actions 运行来源。旧 public status Schema 不改，未把新账户观察写到公开生产状态。
- reconcile.mjs、launch.mjs 和 brightdata-tiktok.yml：新增不接收 Bright Data Secret 的 reconcile；从选定 Actions run 下载 probe artifact，校验来源、Snapshot 和维护者之后的观察，仅核对实际变化，不发采集、不写预算/视频、不部署、不启用变量。证据来源明确为维护者声明，不能冒充独立财务 API 核验。
- brightdata-zero-cost-v2.example.json：完整保留用户提供的 3441/5000、$2 unknown、none-reported；所有真实授权默认未批准，现金/自动充值未知保留 null。模板不是实际授权。
- 自动采集的关闭检查、六团/8 条/北京 08:00、20:00 及原 Pages 发布链路保持。80 条视频、收藏和其他平台数据不改。

没有再次在本地执行原 113 项测试或生产构建。仅增加并执行新的 8 项 V2/核对逻辑验证，再独立执行新增的运行来源验证；修改的工作流单独语法检查。受控数据不能代替真实 API。推送 PR 后 GitHub 自有 CI 会按仓库配置自动运行，不手动重跑该 CI。

本轮所有运行结果、保护性文件指纹和提交交付状态由最终记录保存；真实请求、真实账单、网站部署和正式定时均未执行。
