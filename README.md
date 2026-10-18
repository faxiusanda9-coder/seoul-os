# SEOUL.OS

**Your K-pop Universe, Organized.** 一个独立的 JYP 粉丝网页应用。界面默认简体中文，保留英文编辑式标题。YouTube 视频由已核实的官方频道分别同步；SEOUL.OS 不是 JYP 或 YouTube 的官方产品。

Instagram 播放排查与当前限制见 [Phase 3.1.1 修复报告](docs/phase-3.1.1-playback-repair.md)：已修复错误阻断与重试，目标 ITZY Reel 的官方嵌入仍仅提供封面，未恢复实际视频播放。

**Phase 3.2：已实现 Instagram Business Discovery / TikTok Display API 适配器及北京时间每日 08:00、12:00、20:00 调度配置，当前缺少平台授权，真实开通账号为 0。** 本地清单校验与远程发现成功时间分开记录。见 [实施与验收](docs/phase-3.2-acceptance.md)、[应用、权限和 Secrets 配置](docs/phase-3.2-setup.md)。PR #2 已合并发布，配置发布不代表已获得平台授权。

**Phase 3.4.1 Bright Data TikTok（开发分支，未上线）：** 保留 80 个唯一视频和原收藏 ID。六团采集为北京 08:00/20:00、每账号最多 8 条，内部月预留上限 4,000、额外付费上限 $0。新增独立变量 `BRIGHTDATA_TIKTOK_SCHEDULE_ENABLED`，缺失或非字符串 `true` 时停止同步，保持视频、预算和公开成功时间不变。流程改为：先在关闭采集时审查合并/发布 → 默认分支手动 ITZY 单条 probe → 实测、账单和许可核验并获批准后才开启定时。唯一实际采集密钥来源仍为 Actions Secret `BRIGHT_DATA_API_KEY`。本轮仅更新功能分支，不代表已合并、已连接 API 或已正式运行。见 [启动修复验收与开通步骤](docs/phase-3.4.1/acceptance.md)；历史导入证据见 [Phase 3.4](docs/phase-3.4/acceptance.md)。

## 本地运行

**Bright Data 当前开通流程见 [Phase 3.4.2 操作指南](docs/phase-3.4.2/operations.md)**：默认关闭，先安全审查合并/发布，再 ITZY 单条 probe，最后使用不发采集请求的 reconcile 核对实际额度/账单。$2 Balance 与实际现金支出分开，不伪填为 0。单次授权不会自动启用定时。

需要 Node.js 24+ 和 npm。同步脚本使用 Node 的 TypeScript 类型剥离功能读取共享 schema。

```bash
npm ci
npm run dev
npm run check
npm run test:sync
npm run test:i18n
npm run test:taxonomy
npm run test:official
npm run test:calendar
npm run test:social
npm run build
npm run preview
```

Vite 使用 `/seoul-os/` base。开发地址通常为 `http://localhost:5173/seoul-os/`。`HashRouter` 保证 GitHub Pages 子页面刷新时仍由首页处理路由。

## 频道与数据

- 已核实频道配置位于 `data/youtube/channels.json`。仅 `verificationStatus: "web-verified"` 且 `enabled: true` 的频道参与同步。未核实的 CIIU 不启用；JYP Entertainment 主频道不被冒充为单一艺人频道。
- 每个频道独立执行 `channels.list` → `playlistItems.list` → `videos.list`，核对频道 ID、uploads playlist、公开视频状态和元数据。没有 `search.list`、爬虫、视频下载或前端 API Key。
- 每个频道写入 `data/youtube/<artistId>.json`，构建时由 `scripts/stage-public-data.mjs` 验证后分别复制到 `public/data/youtube/`。前端使用 `${import.meta.env.BASE_URL}data/youtube/<artistId>.json`。示例：[TWICE JSON](https://faxiusanda9-coder.github.io/seoul-os/data/youtube/twice.json)。
- Discover 始终只展示用户当前选择的一个频道。艺人详情页加载该艺人的独立频道。搜索和筛选只作用于当前视频频道；不会生成跨频道视频时间线或排行榜。各频道的演示或历史样本明确标注，真实视频标题保留官方原文，内容类型是 SEOUL.OS 的编辑分类。
- 同步采用稳定 `yt-<videoId>`，去重、原子写入、独立错误报告、有限重试、公开状态复核和 30 天失效处理。单个频道失败不会清空其他频道。元数据失效时，私人 Archive 只保留收藏 ID、分类和艺人 ID，并显示不可用占位。

本地真实同步需要在自己的 `.env` 中设置 `YOUTUBE_API_KEY`（参考 `.env.example`）；此文件被 Git 忽略。密钥只交给 Node 同步脚本，不得加 `VITE_` 前缀：

```bash
node --env-file=.env scripts/youtube-sync.mjs --channel=twice
node --env-file=.env scripts/youtube-sync.mjs --channel=all
```

## 自动部署

`.github/workflows/youtube-sync.yml` 每天 UTC 00:00、04:00 和 12:00（北京时间 08:00、12:00、20:00）运行，也支持手动传入 `channel=all` 或某个已启用的 artist ID。GitHub Actions 定时任务可能延迟。仓库 Actions Secret 名为 `YOUTUBE_API_KEY`。同步后仅在 JSON 有变化时提交；使用 `GITHUB_TOKEN` 推送产生的提交不会自动触发其他工作流，所以同步工作流直接调用可复用的 Pages 部署工作流。普通代码推送由 `.github/workflows/deploy.yml` 部署。

在 GitHub 仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；Actions 的 `GITHUB_TOKEN` 需有仓库内容读写权限。站点访问地址：[SEOUL.OS](https://faxiusanda9-coder.github.io/seoul-os/)。仓库名若改变，需要调整 `vite.config.ts` 中的 `/seoul-os/` base 并重建。

官方 API 文档列出的 `channels.list`、`playlistItems.list`、`videos.list` 各为低成本列表请求。基础预算按每频道每次 3 单位计算：14 个独立艺人频道、每日三次约 126 单位/日；重试会增加用量。具体启用频道数以 `channels.json` 为准，实际配额以 Google Cloud 控制台为准。界面分别显示最近成功检查和内容变化时间。内容无变化时保留原始视频快照，独立 data/status/youtube.json 仍记录成功时间并触发状态发布；元数据保留期刷新不计入实际内容更新。

## 收藏、语言与视觉

收藏和关注分别使用 `seoul-os-archive-v1`、`seoul-os-follow-v1` 的浏览器 `localStorage`，无需账号；语言偏好使用 `seoul-os-locale-v1`，默认中文。旧版 TWICE 收藏可以按原 ID 读取，收藏和关注只在当前浏览器保存，不跨设备同步。主页保留 Warm Ivory、Sage Green、英文杂志式标题与移动端底部导航。

`src/locales/zh-CN.json` 和 `src/locales/en.json` 管理操作文案；YouTube 原始标题不自动翻译。日历默认只加载经过发布验证的 `data/calendar/events.json`；当前快照为 0 条真实活动，官网入口继续可用。2099 年演示事件需要主动启用且不会进入真实 JSON/ICS。JYP Universe 仅展示有来源的历史节点。

## 活动日历引擎（Phase 2C-2）

日历事件与视频收藏分离，继续使用既有关注状态筛选。`scripts/events/` 包含 Ticketmaster Discovery Adapter、人工审核命令和单频道 YouTube 预约直播只读试点；`src/calendar/` 包含严格事件类型、来源与时间校验、状态变化、ICS 导出及 React 视图。公开活动只来自经过身份核实的 Ticketmaster Attraction 或人工确认的官方链接；**当前没有 Ticketmaster Key 与核实的 Attraction ID，真实活动仍为 0，不是无演出结论**。YouTube 直播不会混入公共跨频道日历。

```bash
npm run calendar:coverage       # 有 Key 时列出待人工核验的 Attraction 候选
npm run sync:calendar           # 校验并增量同步；无 Key 时保留合法旧数据
npm run event:manual -- add --artistId=twice --title="已核实的原文标题" --eventType=concert --localDate=YYYY-MM-DD --sourceUrl=https://twice.jype.com/schedule/ACTUAL_DETAIL_ID
npm run event:manual -- review --id=REPLACE_UUID --reviewer=MAINTAINER_NAME
npm run event:remove -- --id=REPLACE_EVENT_ID   # 权利人移除请求
npm run calendar:pilot:youtube -- --channel=twice
```

本地密钥填入被 Git 忽略的 `.env`，执行 `node --env-file=.env scripts/events/sync.mjs`；Actions 使用 `TICKETMASTER_API_KEY` Secret。`.github/workflows/calendar-sync.yml` 在北京时间 08:15 与 20:15 运行，也支持手动触发；数据变化后调用既有 Pages 部署。构建前的 `stage-public-data.mjs` 再次校验和移除禁用事件，并生成 `/seoul-os/data/calendar/events.json`、`/seoul-os/data/calendar/all.ics`。公开 ICS 可以订阅，客户端刷新不保证实时；浏览器按关注艺人即时下载的 ICS 不是在线私有订阅。完整维护步骤和来源条件见[日历指南](docs/phase-2c2/calendar-user-guide.md)、[来源覆盖](docs/phase-2c2/source-coverage.md)和[合规边界](docs/phase-2c2/api-compliance.md)。

## 内容分类与官方资讯入口

视频使用 SEOUL.OS 的八类语义标签（音乐、舞台、幕后、公告视频、直播、综艺、粉丝向、其他）。同步时按标题及有限描述规则分类，分类依据和规则 ID 存在每个频道的 v3 JSON；旧 v1/v2 快照仍可读取。Discover 与 Search 只显示当前搜索结果中有内容的类别及数量。`npm run test:taxonomy` 可验证规则、历史快照和版本兼容；`node scripts/backfill-taxonomy.mjs` 可离线回填旧快照，不调用 YouTube API。

**官网公告与视频分类不同。** `/#/official` 是官方公告／行程的**已核实链接索引**，目前没有获得官网数据定时采集与再发布的明确依据，因此未建立 JYP 网页抓取工作流、公告 JSON 或真实活动数据；Calendar 默认仍显示 0 条官方活动，并提供八个已核实的艺人官网 Schedule 链接。搜索来源或选择艺人只筛选入口，不能被误认为已同步公告。详见 [来源矩阵](docs/jyp-official-source-matrix.md) 与 [Phase 2C 审计](docs/phase-2c-source-audit.md)。

艺人详情页对八个从艺人官网核实的 X 账号提供时间线入口。用户主动点击后才加载 X 官方嵌入脚本；加载失败仍可打开原账号。SEOUL.OS 不使用 X API、不缓存帖文。`src/types/official.ts` 预留公告与活动独立模型，`src/data/officialSources.ts` 明确标注 `automationAllowed=false`；只有将来取得足够授权并重新核实来源后才可编写启用自动同步适配器。`npm run test:official` 检查来源域名、安全日期与保守语义分类。

## Phase 3：官方媒体中心与独立状态

`/#/media?artist=twice&platform=instagram` 是按艺人、平台分别浏览的媒体中心。Discover 的 YouTube 流、原路由和收藏键保持兼容；从 Discover 或艺人详情进入媒体中心。新增 Instagram Reels / 帖子、TikTok、官方公告、演出与活动、作品目录及 X 入口。

- `data/social/accounts.json` 记录 14 个 Instagram、8 个 TikTok 官方账号及逐条证据。其他 TikTok 账号保持待核验，不推测用户名。
- Phase 3.1 实际清单：Instagram 78 条（47 视频、31 图片／轮播帖子），TikTok 35 条单条视频。18 条 Instagram 视频真实站内播放、29 条标记受限、31 条帖子确认站内显示；TikTok 35 条真实站内播放。Instagram 默认显示全部内容，可筛选视频／帖子。官方账号预览位于单条库下方，不计入清单；未确认的标题、缩略图、发布时间留空。
- 视频播放器和 Instagram 官方 `embed.js`、TikTok 官方账号 `embed.js` 均需主动同意后加载。单条 TikTok 使用官方 `/player/v1/<id>`。失败时保留外链。Instagram/TikTok 收藏沿用 Archive 的 `Watch Later`，只存稳定 ID、艺人、分类，不缓存社交视频或全文。
- `data/status/{youtube,instagram,tiktok}.json` 区分 `lastAttemptAt`、`lastSuccessAt`、`lastContentChangeAt`、本次新增/更新、条数及失败来源。YouTube 用 `mode=api`；社交平台当前用 `mode=manual-validation`，成功只意味着本地清单校验，不代表访问原平台或发现新内容。没有历史检查记录时显示“暂无记录”，不伪填历史成功时间。
- Phase 3.2 的 `.github/workflows/social-sync.yml` 计划在北京时间 08:00、12:00、20:00 读取有条件授权的官方 API，并单独校验本地清单。`data/status/social-discovery.json` 记录真实远程发现状态；目前均为 not-configured。`freshness.yml` 在 09:45、13:45、21:45 检查应完成的自动发现窗口，本地清单校验仍单独监控。原 YouTube 三次计划、Calendar 两次计划保留；配置已合并，但真正发现内容仍须平台授权。

```bash
npm run sync:social          # 本地格式/来源校验，无网络抓取
npm run discover:social -- --platform=all --dry-run  # 官方 API 发现试读；当前缺凭证，预期退出 1
npm run test:discovery
npm run social:import -- --file=/path/to/reviewed-links.json --reviewer=MAINTAINER
npm run monitor:freshness
npm run test:social
npm run sync:brightdata:tiktok -- --mode=plan # 纯离线第三方请求计划
npm run test:brightdata
```

Bright Data 的 plan 只读本地配置和预算镜像，不读取密钥/授权、不查询供应商或远端台账。报告中的本地剩余预留空间不是供应商免费额度；密钥、零付费证据及实际账单均保留为未检查。账户 Balance、无支付方式和免费额度不能自动启用采集，控制台确认清单见 [Phase 3.4.1 验收](docs/phase-3.4.1/acceptance.md#8-本次离线-plan-补充与账户确认清单)。

人工导入的历史维护说明见 [Phase 3 实施与维护](docs/phase-3-official-media.md)；当前自动发现实现、限制和开通步骤以 [Phase 3.2 指南](docs/phase-3.2-setup.md) 为准。没有应用审批、授权令牌或可核实接口时，保留人工清单，不记录发现成功。

历史播放证据见 [Phase 3.1 中文验收报告](docs/phase-3.1-acceptance.md)。本地当前 Instagram 78 条；TikTok 80 条包含原 35 条人工记录与 45 条第三方新记录，来源分别标记。开发分支导入不代表线上已更新；维护者可按 Phase 3.4.1 指南在采集默认关闭时审查合并/发布，本轮没有执行合并或生产部署。

## 项目结构

```text
data/schemas/             Content 类型与运行时校验
data/youtube/             已核实频道配置和各频道原始快照
scripts/youtube-sync.mjs  独立频道同步、失效处理和日志
scripts/stage-public-data.mjs  发布前验证与独立静态文件暂存
src/components/           通用编辑式界面组件
src/data/                 艺人档案及明确标注的演示数据
src/locales/              中文、英文操作文案
src/pages/                Discover、Artists、Calendar、Archive 等页面
src/types/official.ts      官网公告与事件的预留类型
src/data/officialSources.ts  已核实链接和自动使用状态
src/data/officialSocialAccounts.ts  从艺人官网核实的 X 账号
src/store/                视频频道状态、收藏与关注状态
.github/workflows/        独立同步与 GitHub Pages 部署
tests/                    Mock API、错误隔离、语言字典测试
docs/                     数据源、政策与验收报告
```

## 政策边界

YouTube 开发者政策对 API 数据聚合及缓存有约束，见 [合规说明](docs/phase-2b-2-compliance.md)。公开页面只提供逐频道独立视图，不提供跨频道 API 数据合并、统一排序或排行。此设计不代表 YouTube 对本项目作出了个别合规批准。Git 历史与 Pages 构建产物的长期元数据留存仍需单独核实；不要将当前实现描述为已经获得公开聚合授权。
