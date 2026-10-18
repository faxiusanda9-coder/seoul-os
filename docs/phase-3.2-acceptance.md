# Phase 3.2：实现与验收报告

日期：2026-10-18（北京时间）。开发分支 `phase3-official-media`，起点 `a980646c23d4b613947f16cc768402be5d98e81a`。开始时工作区干净、PR #2 为开放草稿，原有 52 项测试通过。已阅读用户附件、README、社交账号与内容、Schema、导入/状态/暂存脚本、前端媒体与收藏链路、相关工作流和 Phase 3.1.1。

**交付的是可运行的官方 API 适配器、每日三次调度及验证链路；当前已真实开通自动发现的账号为 0。** 用户已确认目前没有 Meta 或目标账号 TikTok 授权，本地也未发现相关环境变量。没有尝试用 Cookie、私有接口、网页采集或付费代理替代授权；没有伪造真实 API 联调。

## 一、哪些账号已接通

| 分类 | 结果 |
| --- | --- |
| 已真实联调并开通自动发现 | 无 |
| 实现已就绪，等待凭证、审批和账号联调 | Instagram 14 个、TikTok 8 个已核实官方账号 |
| 当前没有可确认的可用账号/数据来源 | 其余 6 位艺人的 TikTok 账号尚未核实；不猜测账号、不创建来源记录 |

这里“实现就绪”指代码可执行且受控测试通过，不保证某个真实账号的权限、数据类型、历史页数和配额已经适配；必须完成真实联调才能升级为开通。Instagram 专业类型均待 API 验证。完整逐艺人账号、接口、缺少配置和调用结果见 [覆盖表](phase-3.2/coverage.md)。

Instagram 采用调用方专业账号的 Business Discovery，非逐位艺人 OAuth；TikTok 采用目标账号本人的 Display API 授权。权限、应用审批、字段、分页与缓存依据，以及准确的配置步骤，见 [开通指南](phase-3.2-setup.md)。相关官方文档于本日核对；Meta 页面浏览工具受限，但通过普通 Node HTTPS 请求成功读取英文官方参考，确认需要 instagram_manage_insights 及嵌套游标分页。TikTok 额外 user.info.profile 用于核对 username。

## 二、已实现的更新链路

`accounts.json → 官方适配器 → 身份与字段校验 → 完整批次 → ID 去重/合并 → 原子 JSON → stage-public-data → SocialContext → 对应艺人媒体页`。

- Instagram 请求 Graph API v26.0 的调用方 ID 和嵌套 business_discovery，核对返回调用方 ID、目标 username、目标数字 ID；读取 media_type、media_product_type、permalink、timestamp、caption。支持 Reel、视频帖子、图片/轮播；不读取 media_url。
- TikTok 先核对 token 的 open_id 与已核实 handle，再读 video/list。保留字符串视频 ID；规范化永久链接，拒绝仿冒域名、账号主页及作者不匹配。OAuth open_id 不写公开数据。
- 已存在的手工内容保持稳定 ID、原核验时间、标题和播放/删除证据，只附加独立 API 观察证据；不会批量改标自动获取。新 API 条目才使用 acquisitionMethod=api、verificationStatus=api-verified。
- API 数字媒体 ID 与 IG shortcode 分开；同一内容不会生成重复卡片。API-only 条目后续原文变化计为 updatedCount；复查时间变化不计内容变化。原人工记录不被 API 改写。
- 请求最多 3 次，单次最长 10 秒；退避和 Retry-After 最长 5 秒；单账号总预算 60 秒。身份错误、分页循环、页数超限及不完整响应都拒绝写入该账号的局部结果，保留旧内容；其他账号继续运行。
- TikTok 使用官方降序加 48 小时重叠窗口；Instagram 不假设顺序，读取完整集合再增量写入。CLI 页数上限默认 20，工作流默认 250，可选 1–1000。大账号可能超限，须真实联调后调整或改进，不能预先声称全覆盖。
- 自动刷新 TikTok 令牌之前要求可持久化加密回存；未配置时明确要求续期。尚未实现公开 OAuth 授权门户，也没有真实应用可供获取首个授权。

## 三、字段、状态与页面

新增 `data/status/social-discovery.json`，与旧 `data/status/instagram.json` / `tiktok.json` 的本地校验历史分开。新 Schema 为 `data/schemas/social-discovery.schema.ts`，不重解释 YouTube 或本地校验的 lastSuccessAt。

| 字段 | 含义 |
| --- | --- |
| sourceId / provider / accountUrl | 官方账号和实际 API 路径的绑定 |
| state | not-configured / auth-required / disabled / ok / failed |
| lastAttemptAt / lastCompletedAt | 实际开始及完成该来源检查的时间，不填计划整点 |
| lastSuccessAt | 最近完成的成功远程发现检查；本地校验不能推进 |
| lastContentChangeAt | 实际新条目或 API 内容字段变化时间 |
| accountVerifiedAt | 最近完成远程账号身份核对的检查时间，未调用为 null |
| newCount / updatedCount | 成功可为 0；未完成为 null，不能冒充新增 0 条的成功 |
| itemCount / pagesRead / failedSources | 保留条数、成功批次页数、脱敏错误代码 |

新记录的 apiEvidence 保存 provider、mediaId、非秘密账号标识、checkedAt 和可选 mediaProductType。旧字段与 schemaVersion=1 保持兼容；仅新增有证据的 API 获取分支，原 URL/身份/时间及人工清单校验仍保留。

页面显示独立的自动发现状态、计划时间、最近成功远程检查和本轮计数；同时保留本地清单校验详情。当前 22 个来源显示尚未开通，最近成功时间为 null。艺人未核实的 TikTok 显示待核实。官方 API 记录有明确来源标签；用户同意前不加载第三方播放器。Phase 3.1.1 的版权限制、原帖可访问性与嵌入可用性继续分开；自动发现不会修复 Instagram 的版权播放限制。

## 四、调度与发布

社交工作流 cron 改为 UTC `0 0,4,12 * * *`，即北京时间 08:00、12:00、20:00；手动支持平台、艺人、页数和 dry-run。开发分支强制 dry-run，禁止提交和发布。YouTube 的三次 cron 与读取逻辑不改。监控改为北京时间 09:45、13:45、21:45，并按应完成的计划窗口加一小时宽限判断，正确处理 20:00 到次日 08:00 的 12 小时间隔。

提交帮助函数对社交和 YouTube 分别限定数据路径，遇到并发推送最多 rebase/push 三次；真实内容冲突直接中止，不 force push、不覆盖其他 JSON。已经用本地裸仓库和多个真实克隆验证独立并发更新保留、冲突拒绝。

构建发布继续复用 Pages 工作流，读取最新 main，并沿用 Pages 并发控制。只有源数据/状态发生变化才提交；成功账号即使其他账号未配置/失败，也可保存并交给构建。CLI 未完成任一来源时返回 1，工作流保留脱敏摘要并报告，不能把整体工作流颜色等同每个账号的状态。

**本轮没有合并、没有生产部署、没有运行默认分支同步。** 新 cron 目前只存在于开发分支，不代表线上已开始每日三次 Instagram/TikTok 自动发现。

## 五、真实数据与测试证据

真实 API 调用成功：0；真实发现条目：0。现有 Instagram 78 条、TikTok 35 条和 YouTube 数据未改。状态试跑只增加 22 个未配置记录；不是新增 0 条的远程成功。

完成的验证：

- 完整 Node 测试：原 52 项加 16 项发现/配置/并发验证，共 68 项。
- 原媒体浏览器回归：11 组，包括 YouTube、搜索、艺人切换、收藏与刷新、同意门禁、播放器错误回退。
- 新发现链路浏览器回归：5 组，以明确的工程 fixture 响应运行真实适配、临时目录原子写入、原构建暂存脚本及实际 React 页面；覆盖来源标签、搜索、收藏/刷新/Archive、375/390/412px、零提前平台请求及状态 503 隔离。
- TypeScript 检查和生产构建；构建保留原先主包大于 500 kB 的非致命提示。
- 令牌回存测试验证 sealed box 可解密到原 JSON，HTTP PUT 不含明文令牌；所有请求、刷新与 Secrets 更新均为受控测试，没有对真实账户执行。

上述测试证明工程链路和边界，不构成真实 API 成功证据。临时 fixture 不写生产 data、public 或 dist；浏览器测试通过拦截数据响应读取临时构建结果，不代表网站新增了该视频。

复现：

```powershell
npm ci
node --test tests/*.test.mjs
npm run check
npm run build
npm run dev -- --port 5174 --strictPort
```

另开终端：

```powershell
npm run test:social:ui
npm run test:discovery:ui
npm run discover:social -- --platform=all --dry-run
```

最后一条在目前无凭证条件下预期退出 1，22 个 not-configured、成功时间 null、计数 null、无平台请求、无写入。真实来源试读步骤见开通指南。证据文件位于 [phase-3.2](phase-3.2/)。

## 六、主要修改文件

| 文件 | 用途 |
| --- | --- |
| `scripts/social-sync/{discover,adapters,http,credentials,retention}.mjs` | 编排、两平台真实官方请求、规范化、有限重试、令牌刷新/回存与保留期 |
| `data/schemas/social-discovery.schema.ts`、`data/status/social-discovery.json` | 独立远程发现状态及新鲜度窗口 |
| `data/schemas/social.schema.ts`、`scripts/social-sync/index.mjs` | API 获取证据与旧格式人工再导入兼容 |
| `scripts/stage-public-data.mjs` | 校验并暂存新状态与 API 内容，剥离过期 API 数据 |
| `src/components/SocialDiscoveryStatus.tsx`、`SocialCard.tsx`、`src/pages/MediaPage.tsx`、两份语言文件 | 独立状态、来源标签及原页面接入 |
| `.github/workflows/social-sync.yml`、`freshness.yml` | 每日三次发现、手动/dry-run/参数与三次监控 |
| `.github/workflows/youtube-sync.yml`、`scripts/push-sync-changes.mjs` | 保持 YouTube 同步，仅增强并发数据推送 |
| `.env.example`、`package.json`、`package-lock.json` | 精确配置项、执行命令、服务端 sealed box 加密依赖 |
| `tests/social-discovery.test.mjs`、`scripts/test-social-discovery-ui.mjs`、`tests/social-media.test.mjs` | 新行为测试及对有证据 API 数据的验收扩展，未删除旧测试 |

## 七、用户下一步

优先建立 Meta 应用、调用方专业账号和 Facebook Page，取得 Business Discovery 所需权限；再对一个艺人执行指南中的真实 dry-run，确认专业类型、完整分页、配额和身份。

TikTok 仍需目标艺人/管理方的 OAuth 合作及应用审批。没有这些条件，当前没有已确认可替代的自动发现来源；保留现有官方嵌入和人工库，不声称自动接通，也未购买或接入第三方采集服务。

本轮可审查代码、运行测试和查看本地页面；后续获授权的真实联调、合并及上线分别进行。
