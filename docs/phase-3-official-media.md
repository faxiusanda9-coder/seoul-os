# Phase 3：实现、来源边界与维护

本文件包含历史实现；当前官方 API 发现代码、未授权状态和三次调度配置见 [Phase 3.2 验收报告](phase-3.2-acceptance.md) 与 [开通指南](phase-3.2-setup.md)。没有平台凭证，当前真实开通的自动发现账号仍为 0。

**Phase 3.1 当前覆盖：Instagram 78 条（47 视频 + 31 图片／轮播帖子），TikTok 35 条视频；14 个 Instagram、8 个 TikTok 官方账号。逐艺人数量、18 条 Instagram 视频真实播放、29 条受限、31 条帖子显示及 35 条 TikTok 真实播放见 [中文验收报告](phase-3.1-acceptance.md)。以下包含 Phase 3 历史审计；当前清单以报告为准。仅更新原 PR #1，不合并、不发布。**

审计日：2026-10-17（北京时间）。起点 main=97e0d162425b47e6d8d6ab7e56e95d94f582d8a5；在独立 phase3-official-media 分支实施。起点工作区干净，原始检出目录未改写用户文件。

## 审计与保留

已检查 README、14 个 YouTube 快照和 channels.json、同步与暂存脚本、全部三份既有工作流、官方来源和 X 账号、类型与运行时 schema、来源矩阵、Phase 2C 审计、Discover/Artist/Archive/Calendar 路径及全部原有测试。审计时五组原有测试均通过（9+1+4+21+4=39）。实际 YouTube 定时为北京时间 08:00、12:00、20:00，保留已有中午核对；不按需求背景中的两次描述删减既有功能。

保留 YouTube 的独立频道、50 条窗口、30 天失效、15 天条目刷新、有限重试、原子写入、公开身份校验；新状态文件不塞入 YouTube 内容 schema。Artist、Discover 的视频主体、HashRouter、五个底部导航、关注和收藏存储键、Calendar/ICS 规则不重写。

## 账号与内容覆盖

Instagram 14 个账号初始从 [JYP 官方 Artist 目录](https://www.jype.com/en/Artist) 核对。Phase 3.1 发现 YAOCHEN 旧目录 noname_0323xx 的公开资料不可用，依据已核实官方 YouTube 完整出站链接及原平台资料，修正为 yao_chen0323；证据在 data/social/accounts.json，不从截断链接猜测。

| artistId       | Instagram handle       | TikTok handle / 状态   |
| -------------- | ---------------------- | ---------------------- |
| twice          | twicetagram            | twice_tiktok_official  |
| stray-kids     | realstraykids          | jypestraykids          |
| itzy           | itzy.all.in.us         | itzyofficial           |
| nmixx          | nmixx_official         | nmixx_official         |
| day6           | day6kilogram           | 待核验                 |
| xdinary-heroes | xdinaryheroes_official | 待核验                 |
| kickflip       | kickflip_jype          | 待核验                 |
| niziu          | niziu_info_official    | niziu_official         |
| nexz           | real_nexz              | nexz_official          |
| jy-park        | asiansoul_jyp          | 待核验                 |
| 2pm            | real_2pmstagram        | 待核验                 |
| boy-story      | official_boystory      | boystory_official_2018 |
| yaochen        | yao_chen0323           | 待核验                 |
| girlset        | girlset                | girlset                |

TikTok 账号依据：TWICE 来自 [平台官方新闻稿](https://newsroom.tiktok.com/twice-2025?lang=ko-KR)；Stray Kids 来自 [平台官方直播新闻稿](https://newsroom.tiktok.com/tiktok-live-lineup-march?lang=ko-KR)；NMIXX 来自 [艺人官网](https://nmixx.jype.com/) 出站链接；ITZY 来自已核实频道[视频说明](https://www.youtube.com/watch?v=4vmBvGMSLBw)中的完整官方 TikTok 链接。此账号验证不是单条视频身份验证。

Instagram 初始清单：twicetagram 的 /reel/DYtXsHuPvZ0/ 与 /p/CNfZNyLLFQC/；本次原平台 embed 返回 200，页面作者 UsernameText 为 twicetagram，再与 JYP 目录交叉确认。这是历史选集，不声称最新；不从转载推断标题或精确时间，publishedAt/title/description 均 null。缩略图 CDN 可能过期且未取得缓存依据，字段保持 null，交由官方嵌入直接展示。

Phase 3 初始 TikTok 清单为 0，oEmbed 返回 429、账号嵌入出现 503。Phase 3.1 改用官方已知单条 Player 确认作者、原始链接并在本站播放，已导入 35 条，覆盖 7 个账号；新增 NiziU、NEXZ、BOY STORY、GIRLSET 的官方账号证据，BOY STORY 尚无通过核验的单条链接。可选账号预览移至内容库下方，不替代或计入视频库。其余 6 位艺人保持待核验。

## 来源与使用方式

| 来源                    | 自动发现                                | 公开展示 / 缓存                                                       | 本次实现                                                                         |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| YouTube Data API        | 已有 Key 的逐频道列表                   | 保留既有政策边界与 30 天处理；不跨频道合并排行                        | 原同步 + 独立状态                                                                |
| Instagram 原始帖子/Reel | 没有启用未授权发现                      | 官方公开嵌入，受账号/作者嵌入设置限制；仅存核验链接与证据，不下载媒体 | 人工导入、原平台嵌入、外链、收藏                                                 |
| TikTok 单条视频         | 未获得目标账号 Display API 授权，不启用 | 官方 Player/Embed；不缓存视频和短时 CDN 封面                          | 人工核验 35 条，真实本站播放通过                                                 |
| TikTok 账号预览         | 不是本站发现任务                        | 官方 Creator Profile Embed 自行呈现；不纳入本站快照                   | 八个核实账号可选预览，受平台可达性影响                                           |
| JYP/NiziU 官网公告新闻  | 没有可靠自动再发布依据                  | 核实入口外链，不采集公告全文                                          | 复用 Official Sources                                                            |
| 官网作品                | 不采集发行列表                          | 八个既有 jype 艺人站导航确认 /discography，只做外链                   | 媒体中心作品入口                                                                 |
| 官方演出活动            | 沿用已核实 Ticketmaster 与人工事件条件  | 保留 Calendar/ICS 来源与时区规则                                      | 复用 Calendar，当前公共事件 0，不解释为没有演出                                  |
| 官方 X                  | 不使用 X API                            | 用户同意后加载已有官方 Timeline；不缓存推文                           | 复用八个账号；切换艺人卸载旧嵌入                                                 |
| YouTube 预约直播        | 既有只读、单频道试点                    | 不混入公共跨频道日历                                                  | 保留 scripts/events/youtube-live-*；媒体中心以官方视频原页面为准，不伪造直播状态 |

### 官方接口调查（本次不启用 IG/TikTok API）

- Instagram API with Instagram Login 面向 Business/Creator 专业账号，使用账号 OAuth 和 instagram_business_basic 读取获授权账号基础媒体；外部客户访问还要满足应用审核/访问等级等条件。不把它当作任意公开个人账号的读取接口。[Meta 官方说明](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/)
- Instagram API with Facebook Login 的 Business Discovery 可在符合条件的调用方专业账号、关联 Facebook Page、应用访问级别和目标专业账号限制下，查询其他合格专业账号的公开媒体；不是每位目标艺人都必然要 OAuth。传统 Facebook Login 路径涉及 instagram_basic、pages_read_engagement，枚举管理 Page 涉及 pages_show_list；角色及 Business Manager 场景可能有额外要求。实际权限需按当前应用控制台及对应端点核实。本项目没有应用/令牌，未测试该路径，不宣称覆盖全部艺人。[Meta Business Discovery](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery/)
- Instagram oEmbed 用于已知公开永久链接的嵌入，不负责发现最新内容。服务端 oEmbed 访问需按 Meta 当前应用及 oEmbed 功能审批/令牌要求配置；不在浏览器放应用令牌。本项目采用公开帖子官方分享嵌入的 blockquote + embed.js，不调用旧 api.instagram.com/oembed，不假设已拥有 Meta oEmbed API 权限。[Meta oEmbed](https://developers.facebook.com/docs/instagram-platform/oembed/)、[Instagram 嵌入帮助](https://help.instagram.com/620154495870484)。Meta 文档抓取曾返回 429，Node 普通访问能返回文档；访问成功本身不代表应用审批或账号授权。
- TikTok Display API 需开发者应用、Login Kit/Display API 产品审批，用户 OAuth，并授予 user.info.basic / video.list。/v2/video/list/ 返回授权用户的视频，不是任意用户名公开发现接口；授权刷新和短时封面 URL 需要维护。[官方入门](https://developers.tiktok.com/doc/display-api-get-started/)。本次无艺人令牌，不实现虚假的全站自动发现。
- 已知视频可使用官方 [Embed Player](https://developers.tiktok.com/doc/embed-player/) / [Video Embed](https://developers.tiktok.com/doc/embed-videos/)；已核实账号可使用 [Creator Profile Embed](https://developers.tiktok.com/doc/embed-creator-profiles/)。平台删除、私密、区域或嵌入限制仍会影响可用性。Creator Profile 的动态内容由 TikTok 渲染，不是本站定时采集。

## 数据与导入

统一社交模型位于 data/schemas/social.schema.ts，Instagram/TikTok 各自快照文件；平台判别、稳定 ig-/tt- ID、艺人、官方账号、规范永久链接和 embed URL 必须一致。URL 拒绝仿冒域名、认证信息、非 HTTPS、异常端口、任意 script HTML；保留来源证据和审核人。重复 ID、未带时区的发布时间、伪造/无效日期、错误平台被拒绝；不知道的时间保持 null，按清单顺序展示。

YouTube、Calendar 继续使用原有领域 schema，不把公告时间、演出发生时间与视频发布时间混在一个精确时间线上。跨平台统一的是来源识别、核验语义及新鲜度状态，不是重写既有视频模型。

人工导入文件是 JSON 数组。以下为结构模板，ACTUAL_SHORTCODE、证据、标题必须替换为原平台人工检查的真实内容，不能原样发布：

```json
[
  {
    "artistId": "twice",
    "platform": "instagram",
    "sourceUrl": "https://www.instagram.com/reel/ACTUAL_SHORTCODE/",
    "confirmedAccountUrl": "https://www.instagram.com/twicetagram/",
    "evidenceUrl": "https://www.instagram.com/reel/ACTUAL_SHORTCODE/embed/",
    "evidenceNote": "审核人实际检查原作者、公开状态及官方账号依据的记录",
    "title": null,
    "publishedAt": null,
    "availabilityStatus": "unknown"
  }
]
```

TikTok 使用 https://www.tiktok.com/@VERIFIED_HANDLE/video/ACTUAL_NUMERIC_ID；confirmedAccountUrl 要与注册表的规范账号完全一致。维护者须实际检查页面或可信官方交叉链接的原作者；工具只验证声明和结构，不能把“URL 带官方用户名”当作远程作者证明。availabilityStatus=available 仅在实际验证可用时填写；访问失败用 unknown/restricted，不据此推断 deleted。更新已有 ID 可修改核验状态；deleted 会在构建发布时移除，Archive 保留 ID 占位。

```bash
npm run social:import -- --file=/absolute/path/reviewed-links.json --reviewer=MAINTAINER
npm run sync:social
npm run test:social
npm run build
```

整批候选先验证再写入，单文件原子替换。相同 ID 再导入不重复；只更新核验时间不计内容变化。跨两个平台文件没有数据库事务，写盘中断后应重跑验证及构建再提交。本轮只推送原 PR 分支，不合并或发布生产。

批量样例：[social-import.example.json](examples/social-import.example.json)。`exampleOnly=true` 会被拒绝，必须替换为真实核验内容并移除标记。Reel 使用 `contentType: reels`；/p/ 普通图片／轮播使用 `post`，只有确认包含视频时才使用 `video-post` 和 `confirmedVideo: true`；TikTok 使用 `short-video`。默认 `availabilityStatus: unknown`；实际显示或播放检查后才标 available。样例未混入生产数据，维护命令继续复用上述 `social:import`。

## 同步与监控

- status/youtube.json 首次是空 sources，不从旧快照猜测历史成功时间。下一次真实 API 运行写入。开始每个来源前记录 running/lastAttemptAt，成功（含无变化）推进 lastSuccessAt；失败保留历史 lastSuccessAt、lastContentChangeAt，并附脱敏错误。
- 新增/原元数据更新/条目移出才推进 YouTube lastContentChangeAt。15 天缓存刷新只改采集验证时间，不算更新；不改变原保留策略。失败时有效旧数据保留，过期数据仍按原逻辑处理。
- 社交平台的 lastSuccessAt 是“本地清单校验”成功时间；人工重新核验记录的 lastValidatedAt 不会被定时校验伪更新。每次清单校验 newCount/updatedCount 为 0；人工导入时记录本次导入新增/变更。没有新内容不算失败。
- YouTube 工作流现在检查并提交 data/status/youtube.json，状态变化也调用原可复用部署。因此无新视频也能进入页面。失败的频道状态会随有效数据发布，随后保留 report-failure 的失败信号。
- social-sync.yml 校验本地清单，提交独立状态并调用部署；若清单损坏，构建拒绝发布，保留线上旧部署，错误可从工作流查看。它不探测社交平台 URL、不下载视频、不声称内容仍可访问。
- freshness.yml 独立检查最新 main 状态，36 小时未成功或 failed/skipped/running 产生工作流警告与失败；没有历史记录产生未知状态警告。纯粹“0 条新增”不会触发错误。平台人工核验的陈旧性需维护者重新检查，不能用本地校验掩盖。
- 页面状态读取失败时显示“暂无记录”，不使用 fetchedAt 冒充 lastSuccessAt 或 lastContentChangeAt。旧快照 fetchedAt 以独立的“数据快照时间”字段展示；Discover/Artist 原说明也改为“数据快照”。状态显示使用北京时间。

## 前端与验证

新入口 /#/media；艺人筛选复用已启用频道列表，URL 可固定 artist/platform。YouTube 页保留独立频道显示并链接完整 Discover 筛选；社交清单的搜索只作用于本平台人工标题、描述和 ID，保留未收录标题和未知日期。收藏继续使用原 Archive；ig-/tt- ID 与 yt- 不冲突，数据不可用显示占位，不伪造 YouTube 链接。没有写入测试视频/活动到发布数据。

第三方脚本与 iframe 由明确的同意按钮按需加载。TikTok 单条播放器通过可信 origin、当前 frame.contentWindow 和 x-tiktok-player 标记接收就绪/错误消息。超时、脚本错误和已知 restricted/deleted 都有外链降级；跨域 iframe load 不被当作播放成功证明。切换平台/账号卸载嵌入。移动端 320/390 宽度验证无整页横向溢出，保留原底部导航。

Phase 3 历史验收命令与结果（Phase 3.1 当前 50/50 测试及浏览器命令见中文验收报告）：

```bash
npm run test:sync
npm run test:social
npm run test:i18n
npm run test:official
npm run test:calendar
npm run test:taxonomy
npm run check
npm run build
```

验收结果：46/46 测试通过，类型检查与生产构建通过。原有 YouTube 快照、Calendar 数据、艺人资料与 Calendar 工作流逐字未改。新增回归覆盖：无变化成功时间、失败恢复、保留期刷新不是内容更新；社交身份/伪造域名/时间/重复 ID；审核人与证据必填；错误批次不落盘；跨次去重；TikTok 作者不匹配；空清单校验成功；源失败隔离和历史成功时间保留。浏览器验证包括原 Discover 50 卡、已有 YouTube 收藏保留、社交收藏重载、无同意时零社交请求、脚本失败外链、空数据、503 降级、320/390px 布局、艺人入口。真实 Instagram 官方 embed 成功生成并展示 Reel 封面及播放按钮，关闭后页面无异常。TikTok 账号脚本失败与单条 Player 错误事件使用受控网络响应验证降级，测试记录仅存在于浏览器响应，没有进入发布数据。真实 TikTok 播放受当前平台访问限制，不能宣称已验证所有账号在当前网络可播。
