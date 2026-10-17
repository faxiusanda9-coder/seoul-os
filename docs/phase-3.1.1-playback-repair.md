# Phase 3.1.1：Instagram 播放故障诊断与修复

核验日期：北京时间 2026-10-18。结论：**本站错误阻止尝试播放的问题已修复；ITZY 目标 Reel 的实际站内视频播放未恢复。** 先完成真实官方播放器诊断与替代形式尝试，再实施状态区分和降级。没有把 iframe 加载、模拟控件或移除提示当作视频播放成功。

## 1. 起点与范围

开始时 `phase3-official-media` 工作区干净，HEAD `8ca2053abe907a6cfcee33323622ae7f4621fdb1`。PR #1 已在上一轮发布中合并，main 为 `d52afe9f6017f6a22c3a988195e5d430bc42c731`；本次先将开发分支快进到该合并提交，再增量修改。已检查 README、数据、Schema、导入/构建脚本、播放器、全局播放器状态、收藏存储、测试及部署触发条件。没有覆盖未提交改动。

本轮不合并、不部署。已合并的 PR 无法承载后续新 diff，因此继续使用原开发分支建立后续草稿 PR，并更新 #1 说明关联修复。

## 2. 原问题的实际原因

线上 ITZY Instagram 库有三条 Reel、两条图片/轮播帖子。用户没有指定 shortcode，故核对全部三条 Reel，以最新记录 `ig-Deiu8BPBfNn` 为主要复现目标。

| ID / 原始内容 | 原字段 | 本轮公开原页面 | 官方嵌入 |
| --- | --- | --- | --- |
| [ig-Deiu8BPBfNn](https://www.instagram.com/reel/Deiu8BPBfNn/) | restricted | HTTP 200，作者 itzy.all.in.us，正文可读 | copyright_blocked=true，无 video / 原生播放控件 |
| [ig-DebGMmgS0lI](https://www.instagram.com/reel/DebGMmgS0lI/) | restricted | HTTP 200，作者与正文可读 | 相同 |
| [ig-DHOB5WwS04T](https://www.instagram.com/reel/DHOB5WwS04T/) | restricted | HTTP 200，作者与正文可读 | 相同 |

问题分两层：

1. `data/social/instagram/items.json` 的旧核验把“嵌入只显示封面”写入 `availabilityStatus: restricted`；`src/components/SocialCard.tsx` 只允许 available/unknown 进入同意及挂载路径。因此三条记录在播放器创建前就被拦截，没有播放按钮。旧证据本来就写明“不推断删除”，UI 却把受限和原内容不可用合并表达。这不是 manual-verified/pending 自动转换导致，也不是 shortcode 解析问题。
2. 绕过 UI 阻断、在本站页面挂载原有官方 `blockquote + embed.js + instgrm.Embeds.process()` 后，Instagram 确实返回封面、Watch on Instagram 和 `copyright_blocked: true`，不提供 video 元素。该内部标志仅作为本轮响应诊断证据，不作为生产前端接口，也不能据此断言具体音乐授权、地区、Cookie 或作者设置的原因。

真实 URL 均为单条 `/reel/<shortcode>/`，不是账号主页；shortcode 与稳定 ID、`embedUrl` 一致。官方 SDK 生成的 iframe 路径也是 `/reel/<shortcode>/embed/`，会自行附加版本和来源参数。没有错误地使用账号嵌入，也没有证据指向 CSS 隐藏、过早卸载或前端读取了另一条记录。

## 3. 先尝试修复实际播放的过程与结果

真实浏览器：Edge headless、独立匿名浏览器上下文、实际官方网络、无响应 mock，移动端宽 390px。执行顺序先诊断，后修改状态模型。

- 对三条原始链接分别打开页面，读取到作者与正文；匿名页面出现登录/注册提示，**未确认原平台视频本身的播放**。
- 在本站页面手动挂载完全相同的官方 SDK，排除原 UI 数据阻断。三条均无 video/native control，响应均有 copyright_blocked=true。
- 对主目标试过官方 SDK 的 `data-instgrm-captioned` 形式，以及同一 shortcode 的 `/p/` 形式；官方响应识别相同作者和帖子，仍无视频元素。未将这些无效替代写入生产数据，也没有引入第三方播放器或绕过限制。
- 同环境对照 TWICE `ig-DegKEZyhoe4`，版权标志为 false，点击后视频时间推进到 4.236646 秒、paused=false、readyState=4。这排除了“当前环境完全不能访问 Instagram”的解释，但不代表所有浏览器环境相同。
- 修改后通过真实 SEOUL.OS 卡片的“在站内播放”再测主目标：iframe 成功出现，但等待原生播放控件 12 秒超时，videoCount=0。点击官方 Watch on Instagram 区域后仍无站内 video；该次诊断没有观察到 popup，不将其写成成功跳转。
- 实际重试两次后均只有一个 iframe；关闭后 iframe=0；375/390/412px 均无横向溢出。原内容、账号和核验链接保留。

按本任务分类属于 **B：原始帖子页面可访问，站内视频播放失败**；“原平台视频已能播放”是用户反馈，本轮匿名浏览器未独立验证。不是 C，不把匿名登录提示或嵌入限制解释为原帖删除。若其他环境连原页面都无法判断，应记录 D。

证据：

- [原始页面、三条官方嵌入和 TWICE 对照](phase-3.1.1/diagnosis.json)
- [两种替代嵌入形式](phase-3.1.1/variants.json)
- [修复后目标 Reel 的真实页面验证](phase-3.1.1/itzy-playback.json)
- [目标 Reel 实际点击、重试、移动端、关闭](phase-3.1.1/itzy-click-retry.json)
- [修复后 TWICE 真实播放回归](phase-3.1.1/twice-playback.json)

当前仍使用公开官方 SDK。Meta 文档页本轮读取返回 429，故不冒称成功访问；另核对 [Meta 官方维护的嵌入插件说明](https://github.com/facebook/meta-embeds-for-wordpress/blob/main/readme.txt) 中的 Instagram embed.js 路径，并实际测试 SDK 创建的 iframe。

## 4. 最小实现与字段变化

| 文件 | 变化与目的 |
| --- | --- |
| `src/components/SocialCard.tsx` | 只对有明确原内容 unavailable 证据的记录阻止尝试；嵌入失败/受限仍允许用户同意后挂载官方播放器。新增重试，重新挂载当前唯一播放器；SDK 加载完成后验证实际初始化方法存在，失败后可重试。Instagram iframe load 只表示嵌入外壳加载，不宣称视频播放成功。TikTok 错误清除等待计时器，保留来源链接。 |
| `data/schemas/social.schema.ts` | 加两个可选且严格校验的字段，以及统一向后兼容解析函数；保留 schemaVersion=1 和旧字段，不放宽现有 URL、账号、证据、时间及身份校验。 |
| `scripts/social-sync/index.mjs` | 人工导入支持新字段；旧格式再次导入时保留已记录的独立可用性证据。默认仍为 unknown/untested，绝不等同 restricted。 |
| `data/social/instagram/items.json` | 仅更新 ITZY 三条 Reel：添加 sourceAvailability=available、embedAvailability=restricted、补充证据与本轮 lastValidatedAt。available 仅指原帖子页面可访问，不保证原视频流可播放。旧 availabilityStatus=restricted 保留用于兼容；ID、URL、标题、发布时间、抓取时间不改。其他 75 条 IG 与所有 TikTok 数据不改。 |
| `src/locales/zh-CN.json`、`src/locales/en.json` | 失败提示为“站内播放暂不可用，原视频可能仍可访问。”；另设明确原内容不可用提示、嵌入外壳说明及重试文字。 |
| `tests/social-media.test.mjs`、`scripts/test-social-ui.mjs` | 增加状态兼容、导入保留、失败/重试、明确不可用、未知旧记录和 YouTube 回归验证。 |
| `scripts/verify-social-playback.mjs` | 真实验证不再跳过 restricted 记录；失败也记录 iframe/video/版权标志、来源链接、布局和关闭结果。失败仍返回非零退出码，不将降级验收算作播放成功。 |

字段定义与兼容规则：

| 概念 | 字段 / 取值 | 旧记录缺少新字段时 |
| --- | --- | --- |
| 原始页面可访问性 | sourceAvailability: available / unavailable / unknown | 旧 deleted 映射 unavailable；其余一律 unknown，包括旧 available |
| 站内嵌入核验 | embedAvailability: available / failed / untested / restricted | 旧 restricted 映射 restricted；其余 untested，不从已加载外壳推断可播放 |
| 官方身份核验 | verificationStatus、acquisitionMethod | 沿用 manual-verified；不参与可用性推断 |

三条 lastValidatedAt 分别更新为 `2026-10-17T16:26:41.225Z`、`16:27:00.027Z`、`16:27:18.481Z`（同一 UTC 日期）。这不是重新抓取内容，不改 fetchedAt，也不伪造新的自动同步任务时间。其余旧记录无需批量迁移。浏览器暂时失败只影响当前播放器状态，不写回清单或收藏存储。

发布数据仍由原 `scripts/stage-public-data.mjs` 校验并暂存，由 `src/store/SocialContext.tsx` 读取；没有修改该读取链路和删除记录的发布规则。明确 sourceAvailability=unavailable 的非 deleted 记录仍可显示核验提示及外链；旧 deleted 按既有规则不再发布媒体元数据。

## 5. TikTok 检查

35 条现有记录均使用真实 `/@handle/video/<id>`，嵌入地址是官方 `https://www.tiktok.com/player/v1/<id>`。账号预览是独立组件，没有用 Creator Profile 冒充单条视频。[TikTok 官方播放器文档](https://developers.tiktok.com/docs/en/embed-player) 支持该路径及 onPlayerReady / onPlayerError 消息。

本轮实际复测 ITZY `tt-7686800836638330120`：currentTime=0.510839、paused=false、readyState=4、errorCode=null；关闭和移动布局通过，见 [真实证据](phase-3.1.1/tiktok-playback.json)。没有发现当前数据中的同类阻断，但共享的旧 restricted 门禁存在相同潜在问题，本次一并解除错误推断。受控测试确认 TikTok 出错后仍有原始链接，拒绝错误消息来源；没有新增任何生产视频。

## 6. 测试结果与复现

本轮完整测试 52/52 通过；浏览器工程回归 11 组通过；TypeScript 检查及生产构建通过。构建仍提示现有主包大于 500 kB，该提示不导致失败，本次不扩展到打包重构。工程回归使用受控平台响应，只证明页面行为，**不是实际播放证据**；真实播放证据单独保存。

```powershell
npm ci
node --test tests/*.test.mjs
npm run check
npm run build
npm run dev -- --port 5174 --strictPort
```

在另一终端运行：

```powershell
npm run test:social:ui
node scripts/verify-social-playback.mjs --platform=instagram --id=ig-Deiu8BPBfNn
node scripts/verify-social-playback.mjs --platform=instagram --id=ig-DegKEZyhoe4
node scripts/verify-social-playback.mjs --platform=tiktok --artist=itzy --limit=1
```

默认使用 Windows Edge 或 Chrome；可通过 `BROWSER_EXECUTABLE` 指定浏览器，`BASE_URL` 指定本地站点。ITZY 命令目前预期退出码 1，证据中 playbackConfirmed=false；两个实际播放对照退出码 0。不要改脚本把目标失败算作成功。结果写入未跟踪的 test-results；已审查的本轮结果保存在本报告所链接的目录。

手动复现：访问 `http://localhost:5174/seoul-os/#/media?artist=itzy&platform=instagram`，找到 ID=ig-Deiu8BPBfNn 的卡片，点击“在站内播放”。检查官方 iframe 出现，再点击平台播放区域；当前响应只有 Watch on Instagram 封面。分别试重试、关闭、重新打开、切换艺人，确认只有一个 iframe。点击原始内容和官方账号，查看核验依据。开发者工具中检查官方 iframe 文档的 video 元素及实际播放时间；单纯 load 事件不算播放。

覆盖：合法/非法 IG URL，人工清单默认与身份隔离，新字段校验，旧数据兼容，明确不可用内容，SDK 503 与恢复，嵌入外壳成功/失败，TikTok ready/error/伪造来源，用户同意前零平台请求，重复点击和重试、移动宽度、切换清理、收藏刷新持久化。YouTube 原有 50 条展示、官方播放外链、搜索、艺人切换和收藏回归通过；原 YouTube 本来是官方页面跳转，本轮没有改写为新的站内播放器。

## 7. 尚未完成的外部条件

没有需要提供密码、令牌或改浏览器隐私设置的步骤。若要让这三条受限视频实际站内播放，需要平台今后提供可播放的官方嵌入响应；当前没有已验证的应用侧修复能改变这一结果。用户可继续通过原始链接在原平台观看。登录后是否改变嵌入结果本轮未验证，不保证登录能解决。

本地修复可预览，线上页面仍是此前版本。后续是否合并、部署由单独指令决定，本轮没有执行。
