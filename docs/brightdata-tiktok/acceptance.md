# Bright Data TikTok Posts：开发分支验收

核实日期：2026-10-18。基线：`fba011760d29ec39f44874c571e22b4854bd1abb`；分支：`feat/brightdata-tiktok`。开始时工作区干净。未覆盖个人未提交改动，未合并、未部署或修改线上 Secrets。

## 当前结论

代码准备、预算拦截、数据合并、运行时校验、页面读取和测试已实现。**没有可用 Bright Data Token，真实 ITZY 数据质量未验证，第三方公共元数据展示许可和账号免费条件尚未确认。不能认定已经接通，也尚不具备申请上线的条件。**

执行 ITZY 单条 probe 的实际结果：`BRIGHTDATA_TOKEN_MISSING`，`requests=0`、`connected=false`、`contentWrites=0`。请求在网络调用前被拦截；没有产生费用、导入视频或伪填成功时间。此结论来自本地程序的请求计数，不是账户账单核验。

## 一、已核实的实际接口

依据 [Bright Data 官方机器可读目录](https://docs.brightdata.com/scrapers/tiktok.com.json)、[TikTok 介绍](https://docs.brightdata.com/products/scrapers/tiktok/introduction)、[异步请求参数](https://docs.brightdata.com/api-reference/rest-api/scraper/asynchronous-requests)：

| 项目 | 本实现 |
| --- | --- |
| 数据集 | `gd_lu702nij2f790tmv9h`，TikTok - Posts |
| 账号帖子发现 | `POST https://api.brightdata.com/datasets/v3/trigger` |
| 查询 | `dataset_id=gd_lu702nij2f790tmv9h&type=discover_new&discover_by=profile_url&include_errors=true&format=json&limit_multiple_results=8` |
| 请求体 | `{ "input": [{ "url": "https://www.tiktok.com/@itzyofficial/", "num_of_posts": 8, "include_pinned_post": false }], "limit_per_input": 8 }` |
| 鉴权 | 服务端 `Authorization: Bearer ...`，不进入 Vite 或公共 JSON |
| 进度 | `GET /datasets/v3/progress/{snapshot_id}` |
| 结果 | `GET /datasets/v3/snapshot/{snapshot_id}?format=json` |

[进度接口](https://docs.brightdata.com/api-reference/web-scraper-api/management-apis/monitor-progress) 列出 starting/running/ready/failed。代码严格匹配任务 ID、数据集 ID，限时轮询；错误即停止本轮后续账号请求，POST 不自动重试。

已保存官方目录选取的字段及目录 SHA-256：`data/providers/brightdata-tiktok-contract.json`。没有使用另一个 `gd_m7n5v2gq296pex2f5m` Fast API 的示例参数替代当前数据集，也未猜测 `sort_by` 的枚举值。

**仍待真实 probe 确认的接口细节：** 目录对 `discover_by_profile_url` 仅简列 `url/discovery_input`，完整帖子字段列在标准 Posts 输出 Schema 中。代码要求实际结果同时包含 `post_id`、`url`、`create_time`、`profile_username`、`profile_url` 和 `post_type=video`。如果真实发现接口只返回链接或缺少作者字段，程序会拒收，不能声称适配完成，也不会自动追加另一轮可能收费的详情请求。

## 二、计费、额度与零付费边界

[TikTok 产品价格页](https://brightdata.com/products/web-scraper/tiktok) 本次列出成功交付记录为计费单位，PAYG 为 $1.50/1,000 条。[免费额度文档](https://docs.brightdata.com/general/account/billing-and-pricing/free-tier) 说明新账户每月 5,000 共享积分、Web Scraper 每条结果消耗一个积分；有充值余额时可自动转扣余额。订阅或自定义定价账户不应假设符合该免费方案。**账户实际计划与余额未读取，不能保证宣传价格适用于用户。**

- 8 账号 × 8 条 × 每日 2 次 × 31 天 = **3,968 条/月上界**；单条 ITZY probe 额外预留 1 条。旧视频重复读取也消耗预留额度，不因新增为 0 而免费。
- 项目硬上限 **4,000 条/月**，付费上限 **$0**；不能通过工作流输入增加上限。每次 POST 前必须原子写入预算预留；CI 还必须先将预留单独提交并推送成功。
- 本地预留不是实际账单。`paidSpendUsd=null` 明确表示未核实，不能显示成已确认花费 $0。没有编造余额查询接口。
- 默认关闭。即使有 Token，也必须提供当月有效的私密零付费/使用许可确认：独占账户、确认可用的免费积分、无充值余额、关闭自动充值、供应商免费账户硬停止、公共元数据用途许可及证据。否则请求数为 0。
- 独占条件避免其他产品并发耗用同一免费池；若使用共享/充值账户，现实现拒绝请求。不能用项目计数代替服务端付费保护。
- 每次检查免费剩余额度与本地累计预留；不足整个目标批次时不开始。许可或当月确认到期、HTTP 402/限流/其他失败均停止请求。保留现有有效内容。
- 超时后保留预留，未知任务阻止后续请求；不自动退回预算。跨月仍保留历史与未决任务。状态文件损坏或缺失不自动重置为零。

## 三、账号、使用条款与内容许可

8 个账号直接来自 `data/social/accounts.json` 的 verified TikTok 映射：TWICE、Stray Kids、NMIXX、ITZY、NiziU、NEXZ、BOY STORY、GIRLSET。各条记录保留官网、TikTok 官方新闻稿或已核实 YouTube 频道交叉链接。返回数据的作者用户名、作者主页和视频 URL 中用户名须三方一致；供应商的蓝标字段或 `offical_item` 不能替代这些证据。

[Bright Data MSA](https://brightdata.com/license) 要求尊重第三方权利，数据集可能另有附加条款；一般服务许可不等于给 SEOUL.OS 公共展示授予完整第三方内容权利。[AUP](https://brightdata.com/acceptable-use-policy) 禁止收集登录后的非公开内容。当前没有拿到本账户/数据集针对该用途的确认。

[TikTok 条款的官方检索结果](https://www.tiktok.com/legal/page/us/terms-of-service/en?region=us) 涉及自动化收集限制；该原文页面在本执行环境被阻止访问，无法完成现行地区条款全文复核。不能把第三方服务销售、公开链接或蓝标等同于 TikTok 官方授权。**现阶段使用条件结论为未确认，真实调用默认被许可开关拦截。**

只保存 ID、时间、原始链接和必要来源证据；不缓存标题/正文/头像/缩略图、Cookie、CDN 地址、视频下载地址或视频文件。播放器沿用 [TikTok 官方 Embed Player](https://developers.tiktok.com/docs/en/embed-player)，`/player/v1/<id>`；需用户同意后加载，失败保留原始链接。30 天仅是项目保守保留期，不能解释为平台许可。

## 四、数据与页面链路

`data/social/accounts.json` → `scripts/brightdata-tiktok/{budget,adapter,sync}.mjs` → `data/social/tiktok/items.json` / 独立状态 → `scripts/stage-public-data.mjs` → `public/data/...` → `SocialContext` / `BrightDataStatus` → `SocialCard` 官方播放器。

| 文件/字段 | 变化与含义 |
| --- | --- |
| `data/schemas/social.schema.ts` | 新增 `acquisitionMethod=third-party-api`、`verificationStatus=account-matched`；不是 `api-verified` |
| `thirdPartyEvidence` | provider、datasetId、snapshotId、videoId、authorHandle、authorProfileUrl、originalUrl、rawCreateTime、accountEvidenceUrl、checkedAt |
| 稳定 ID | 始终 `tt-<post_id>`，按字符串处理，拒绝不安全数值 ID；跨人工/官方/第三方去重 |
| 原始日期 | `publishedAt` 保留供应商时区；拒绝无时区、1970 年样例错误和未来异常日期，不根据 ID 推算发布时间 |
| 原始/嵌入可用性 | 新记录为 unknown / untested；供应商返回记录不等于原视频或播放器实测可用 |
| 原有记录 | 保留 ID、人工/官方核验、收藏、删除及播放证据；第三方只附独立证据，不冒充原核验人 |
| `data/usage/brightdata-tiktok.json` | 持久化额度预留和任务生命周期，不复制到公共页面；不可删除以重置额度 |
| `data/status/brightdata-tiktok.json` | 逐账号尝试/成功/内容变化时间、新增/更新、返回数量、错误；独立预算与确认有效期 |
| `src/components/BrightDataStatus.tsx` | 可折叠展示第三方状态、预算上界与失败原因，不混入 Display API 成功记录 |
| `SocialCard.tsx` | 标记“Bright Data 第三方获取 · 作者匹配”，继续复用原播放器与收藏 |

观察时间变化不计为内容更新；没有新增也可记录真实成功时间。probe 不导入，不把拟新增计为实际新增。数据质量失败时不写内容，已有有效数据保留。API 来源可独立附加或升级为官方证明；两类证据不会混写。

## 五、工作流与自动监控

新增 `.github/workflows/brightdata-tiktok.yml`，cron 为 **`0 0,12 * * *`**。原 `youtube-sync.yml`、`social-sync.yml`（Instagram/Display API）和 `calendar-sync.yml` 的文件内容没有改变。

默认一账号一任务最多 8 条，8 账号按顺序检查，共用既有 social-manifests 并发锁。开发分支工作流强制为离线 plan。将来获准合并后，真实 sync 仍要求专用开关和许可/预算 Secret；代码合并本身不代表已接通。

正式 CI 请求前单独提交预算，随后提交元数据和状态。使用 GITHUB_TOKEN 的数据提交不会自动触发其他 Actions，所以有变化时显式调用既有部署工作流。本轮没有执行默认分支工作流或发布任何数据。

复用 `scripts/check-freshness.mjs`：第三方失败、暂停和已启用来源逾期单独报告，08:00/20:00 窗口有一小时宽限。工作流上传脱敏摘要，最后明确失败；不会将失败请求显示为成功同步。

## 六、可复现验证

```powershell
npm ci
node --test tests/*.test.mjs
npm run check
npm run build
node scripts/brightdata-tiktok/sync.mjs --mode=plan --artist=itzy --limit=1
node scripts/brightdata-tiktok/sync.mjs --mode=probe --artist=itzy --limit=1
```

最后两条在当前无 Token 环境预期退出 1，摘要为 Token 缺失、零请求；不是测试失败或平台连接成功。

启动单独的本地测试服务器后：

```powershell
npm run dev -- --port 5181 --strictPort
# 另一个终端
$env:BASE_URL='http://localhost:5181/seoul-os/'
npm run test:social:ui
npm run test:discovery:ui
npm run test:brightdata:ui
```

浏览器测试中的 API 响应和播放器错误均为明确标记的工程夹具。测试数据只存在隔离临时目录，经过真实暂存与页面读取链路，不进入生产清单。不能作为真实 API、账单、许可或视频播放成功证据。

浏览器限制：headless Edge 在操作跨域播放器夹具后，鼠标关闭动作没有向主文档投递 pointer/click 事件，iframe 未卸载；不是可认定为已通过的鼠标关闭验证。沿用既有测试的键盘关闭路径继续验证组件卸载，手机真实触摸关闭仍待实际设备检查。没有为规避该环境现象修改原播放器事件或冒充实际播放成功。

验证结果：完整 88 项 Node 测试通过，其中新增 20 项覆盖预算、失败保留、全 8 账号、来源区分、真实本地 Git 预算先行提交与并发保护。TypeScript、生产构建通过。既有媒体中心 11 组、官方 API 发现 5 组、新第三方链路 5 组浏览器工程验证通过。既有清单测试扩展为对第三方内容严格核验 provider、作者匹配、视频 ID、日期和非官方授权状态，未移除测试或跳过校验。

生产构建保留原有主包超过 500 kB 的非致命提示。原始 Instagram 78 条、TikTok 35 条及 YouTube/日历数据没有被本次实现改写；未使用生产清单存放模拟记录。

## 七、上线前尚缺什么

1. 私下配置 Token，取得账号免费资格、充值余额为零、关闭自动充值及免费耗尽硬停止的实际证据。
2. 核实本账户、该数据集、适用地区与 SEOUL.OS 公共最小元数据展示用途的许可，保存证据；不能仅勾选模板中的布尔值。
3. 开发分支本地执行 ITZY 单条真实 probe，人工比对视频 ID、官方作者、发布时间、原始链接、排序/置顶行为和字段完整性。若只有链接或异常日期，继续修复，保持停用。
4. 真实数据和使用条件都通过后才申请合并/上线；没有这些证据，本 PR 保持草稿。
