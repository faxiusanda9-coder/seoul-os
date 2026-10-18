# Phase 3.2：平台授权与开通步骤

日期：2026-10-18（北京时间）。**代码已经提供官方 API 读取路径，但当前没有平台应用和授权，尚未真实开通任何 Instagram/TikTok 自动发现账号。** 先在开发分支完成真实联调，不能只因下面的工程测试通过就称为开通。不要在聊天中发送密码、令牌或 Cookie。

## Instagram：先配置调用方，再验证目标账号

使用 [Instagram API with Facebook Login / Business Discovery](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery/?locale=en_US)。读取其他符合条件的 Business/Creator 账号媒体，不要求每位目标艺人先给本站 OAuth。目标账号的类型与年龄限制仍须实际验证；目前 14 个已核实账号的专业类型均未通过 API 确认。

1. 建立自己的 Meta 开发者应用，选用 Instagram API with Facebook Login。准备自己管理的 Instagram 专业账号及关联 Facebook Page。这是查询发起方，不是把艺人的用户名填成自己的账号 ID。
2. 按[官方 Business Discovery 权限参考](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery/?locale=en_US)取得 Facebook User access token：`instagram_basic`、`instagram_manage_insights`、`pages_read_engagement`。枚举自己管理的 Page 另用 `pages_show_list`；若 Page 权限经 Business Manager 授予，还需官方列出的 `ads_management` / `ads_read` 之一。不要把 Instagram Login 的 `instagram_business_basic` 当作这个 Facebook Login 路径的替代权限。
3. 使用自己管理的 Page 找到关联 Instagram 专业账号 ID，例如官方 Graph API 的 `me/accounts` 与 `instagram_business_account` 字段。将这个调用方 ID 保存为 `INSTAGRAM_IG_USER_ID`。
4. 根据应用实际使用场景完成访问等级、App Review、业务验证及公开站点要求。开发模式下自己的测试请求通过，不等于生产用途的所有审批都已完成。
5. 在本地被 Git 忽略的 `.env` 或 GitHub 仓库 Settings → Secrets and variables → Actions 中配置下表。记录令牌真实到期时间，不猜测有效期。

| 名称 | 含义 |
| --- | --- |
| `INSTAGRAM_ACCESS_TOKEN` | 调用方的有效 Facebook User access token |
| `INSTAGRAM_IG_USER_ID` | 调用方自己的 Instagram 专业账号数字 ID |
| `INSTAGRAM_ACCESS_TOKEN_EXPIRES_AT` | 可选但建议填写的真实到期 ISO 时间，含时区 |
| `INSTAGRAM_GRAPH_VERSION` | 本地环境变量或 Actions Variable；当前默认 `v26.0`，升级前重新核实接口 |

先验证一个账号：

```powershell
node --env-file=.env scripts/social-sync/discover.mjs --platform=instagram --artist=itzy --max-pages=250 --dry-run
```

输出必须是该账号身份匹配、媒体列表完整读取后的 `state=ok`。`--dry-run` 只读取和生成内存预览，不写内容、状态、令牌，不提交和部署。可返回正常的 0 新增；没有凭证则返回 not-configured，退出码 1。

Instagram 使用官方嵌套 `.media.after(cursor)` 分页，不跟随可能带令牌的 next URL，也不假设支持时间过滤或自定义排序。当前实现为完整遍历接口可返回的集合，再按稳定 ID 增量合并；不是只取首页就声称覆盖全部最新内容。CLI 默认上限 20 页，定时任务为 250 页，可调到 1000；单账号 60 秒预算。大型账号若超出任一限制，会返回 `PAGE_LIMIT_INCOMPLETE` 或 `SOURCE_TIME_BUDGET_EXCEEDED`，整批不写，保留此前内容和成功时间。**真实开通前必须测量该账号所需页数、实际配额与执行时间；若仍无法完成，不得把它标为已开通。** 本轮因无令牌无法测量，不能保证每个艺人均能在该预算内完成。

当前不调用 Meta 令牌自动交换接口，也不假定令牌永不过期。到期或授权撤销后显示 auth-required，由维护者通过官方流程续期并替换 Secret；因此 Instagram 自动读取仍有凭证维护要求。

## TikTok：每个目标账号分别授权

依据 [Display API 入门](https://developers.tiktok.com/docs/en/display-api-get-started)、[List Videos](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list)、[Get User Info](https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info)。

1. 创建 TikTok 开发者应用，并取得 Login Kit / Display API 相应产品审批。
2. 由希望接入的**目标账号本人/其管理方**通过正式 OAuth 授权。站长自己的账号只能授权站长自身内容，不能因此获得 ITZY、TWICE 等艺人的列表。
3. 本实现需要 `video.list`、`user.info.basic`，另需 `user.info.profile` 读取 username，以便将令牌主体与已核实的艺人 handle 严格比对。仅有显示名不足以核实作者。
4. 按官方 Web Login Kit 完成经过注册的回调及 code 交换。保密的 code 交换必须由受控服务端/本地维护流程完成，不在 GitHub Pages 前端放 client_secret。本站未新增面向艺人的授权门户或公共 OAuth 回调服务；在取得艺人合作和应用审批后，需先完成这一步以取得初始授权。
5. 将每位艺人授权安全地保存到一个 `TIKTOK_CREDENTIALS_JSON` Secret，键为本站 artistId。以下只是结构说明，不能把占位值投入生产：

```json
{
  "itzy": {
    "accessToken": "REPLACE_WITH_REAL_AUTHORIZED_TOKEN",
    "openId": "REPLACE_WITH_REAL_OAUTH_OPEN_ID",
    "expiresAt": "REPLACE_WITH_REAL_ISO_EXPIRY",
    "refreshToken": "REPLACE_WITH_REAL_REFRESH_TOKEN",
    "refreshExpiresAt": "REPLACE_WITH_REAL_REFRESH_EXPIRY"
  }
}
```

`accessToken`、`openId`、`expiresAt` 必填；刷新字段可选。上面结构不能导入内容清单。Open ID 只用于服务端授权绑定，不写入公开 JSON 或日志；公开内容证据使用已核实 handle 和视频 ID。

单账号试读：

```powershell
node --env-file=.env scripts/social-sync/discover.mjs --platform=tiktok --artist=itzy --max-pages=250 --dry-run
```

先核对 `/v2/user/info/` 返回的 open_id 与 username，再调用 `/v2/video/list/`。视频 ID 全程为字符串。按官方明确的 create_time 降序，首次完整扫描，以后覆盖最近成功检查前 48 小时，避免刚发布和迟到记录漏入；更久以前的迟到/重新公开记录不保证由增量窗口发现，需另行完整复查。空列表不导致旧清单删除。

## 可选：TikTok 令牌自动刷新与持久化

官方说明见 [User Access Token Management](https://developers.tiktok.com/docs/en/oauth-user-access-token-management)。正常 access token 有限期；refresh token 也可能轮换，必须保存新值。

| Actions Secret | 用途 |
| --- | --- |
| `TIKTOK_CLIENT_KEY` | 已获批应用 client key |
| `TIKTOK_CLIENT_SECRET` | 应用保密凭证 |
| `SOCIAL_SECRET_WRITER_TOKEN` | 可选：仅选此仓库、具有 repository Secrets read/write 权限的 fine-grained PAT；需维护其到期时间 |

工作流提供的 `GITHUB_REPOSITORY` 指定当前仓库。`GITHUB_TOKEN` 不被当作 Secrets 写入凭证。代码使用仓库公钥和 libsodium sealed box 加密，再调用 [GitHub Actions Secrets API](https://docs.github.com/en/rest/actions/secrets#create-or-update-a-repository-secret) 更新 `TIKTOK_CREDENTIALS_JSON`。

距 access token 到期不足 15 分钟时，只有应用凭证、refresh token、持久化权限全部存在且不是 dry-run，才调用刷新接口。新 refresh token 成功加密回存后才继续读取视频。无持久化能力、刷新失败、主体不匹配、授权范围不足或保存失败时，状态为 auth-required；不假装自动刷新完成。网络不确定的刷新请求不会自动重试，以降低轮换后丢失凭证的风险。

没有配置自动回存权限时，必须在到期前通过官方流程更新整个 Secret。**并非填一次短期令牌即可永久无人维护。** GitHub Secret 更新与真实 OAuth 刷新本轮仅完成受控测试，尚未真实联调。

## 定时、手动运行与上线边界

- `.github/workflows/social-sync.yml`：UTC `0 0,4,12 * * *`，对应北京时间 08:00、12:00、20:00。支持 platform、artist、max_pages、dry_run。手动默认 dry-run；开发分支强制 dry-run。
- YouTube 的定时和 API 逻辑不变；只将数据提交改用同一个有限重试的安全推送帮助函数，避免两个同步任务同时写 main 时覆盖彼此。
- 页面和 CLI 区分未配置、授权待续、远程失败和远程成功。任何未开通来源都不刷新最近成功发现时间。CLI 有任一非主动停用来源未完成时退出 1；工作流仍会保存成功账号和状态，再报告未完成，不能仅以整个工作流红绿判断每个账号。可用环境变量 / Actions Variable `SOCIAL_DISABLED_SOURCES`（逗号分隔的已核实 sourceId，例如 `instagram:day6`）主动保持某来源人工维护；停用不记远程成功、计数为 null，也不会请求它。
- 数据变化后，工作流才提交对应 JSON，并调用既有 Pages 发布链路。构建读取最新 main，沿用 Pages 并发取消旧发布机制。本轮没有运行这一生产发布流程。
- 定时任务仅在后续获准合并到默认分支后生效；GitHub 可能延迟执行，页面更新还需构建部署。见 [GitHub schedule 文档](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

本地写入命令（取得授权并确认试读结果后，在开发分支执行）：

```powershell
node --env-file=.env scripts/social-sync/discover.mjs --platform=instagram --artist=itzy --max-pages=250
npm run sync:social
npm run build
npm run dev -- --port 5174 --strictPort
```

确认真实条目经过 JSON → public/data → 页面后，再提交 PR。配置令牌、真实请求成功、代码通过审核、合并与部署是分别需要完成的步骤；目前尚未完成前两项。

## 使用与缓存边界

仅保存 API 返回并通过身份核验的内容 ID、永久链接、原文描述、发布时间与最小证据；不请求下载地址、不下载视频、不缓存媒体和短期 CDN 封面。API 文本上限 10000 字符，保留原文而非截断成虚构标题；旧人工记录仍保留原 2000 字符校验。

项目对 API 元数据采用保守的 30 天复核/淘汰规则，这不是对平台许可期限的通用承诺，部署者仍须遵守所获应用的实际条款、删除请求和授权范围。过期 API-only 条目从源清单与发布数据移除；过期附加 API 证据只从人工记录剥离，人工原数据不被删除。收藏 ID 保留。其他未过期内容不会因为请求失败、分页未完成或列表中暂未出现而清空。明确删除仍使用原有 deleted / 来源可用性规则。
