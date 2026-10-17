# Phase 3.1 中文验收报告

本轮继续使用 `phase3-official-media` 与 [PR #1](https://github.com/faxiusanda9-coder/seoul-os/pull/1)，等待人工验收；不合并、不发布生产。基线为 `1d5234c18773d6ebf1d946a299f6dd42c822e115`，开始时工作区干净。核验日期为 2026-10-17 UTC；逐条文件保留完整 UTC 时间，页面发布时间转换为北京时间并标明 UTC+8。

## 实际结果

| 项目                      | 基线 |                    本轮结果 |
| ------------------------- | ---: | --------------------------: |
| 已核实 Instagram 官方账号 |   14 | 14（修正 YAOCHEN 账号映射） |
| Instagram 单条视频        |    1 |                 47，新增 46 |
| Instagram 图片／轮播帖子  |    1 |                 31，新增 30 |
| Instagram 总记录          |    2 |      78，覆盖全部 14 位艺人 |
| 已核实 TikTok 官方账号    |    4 |                           8 |
| TikTok 单条视频           |    0 |           35，覆盖 7 个账号 |

合计新增 111 条真实记录，最终 113 条。没有把账号主页、测试占位、合作方原作者或图片帖子计作官方单条视频。页面按用户后续要求默认显示全部 Instagram 内容，仍可选择“全部视频”“Reels”“含视频帖子”“其他帖子”。

| 艺人 ID        | IG 总记录 | IG 视频 | IG 帖子 | IG 实际播放通过 | TikTok 视频／播放通过 |
| -------------- | --------: | ------: | ------: | --------------: | --------------------: |
| twice          |         8 |       5 |       3 |               3 |                 5 / 5 |
| stray-kids     |         3 |       2 |       1 |               1 |                 5 / 5 |
| itzy           |         5 |       3 |       2 |               0 |                 5 / 5 |
| nmixx          |         6 |       3 |       3 |               1 |                 5 / 5 |
| day6           |         5 |       3 |       2 |               3 |                     0 |
| xdinary-heroes |         7 |       3 |       4 |               0 |                     0 |
| kickflip       |         6 |       5 |       1 |               2 |                     0 |
| niziu          |         6 |       5 |       1 |               0 |                 5 / 5 |
| nexz           |         6 |       5 |       1 |               0 |                 5 / 5 |
| jy-park        |         6 |       4 |       2 |               3 |                     0 |
| 2pm            |         4 |       3 |       1 |               2 |                     0 |
| boy-story      |         6 |       2 |       4 |               2 |                     0 |
| yaochen        |         6 |       0 |       6 |               0 |                     0 |
| girlset        |         4 |       4 |       0 |               1 |                 5 / 5 |

## 真实显示与播放

- Instagram：47 条视频全部在本地 SEOUL.OS 卡片中测试，18 条确认原生 `video.currentTime > 0.5`、`paused=false`、`readyState>=2`。29 条官方嵌入仅返回封面和“Watch on Instagram”链接，复核均 HTTP 200、无原生播放控件及 video 元素；已将 `availabilityStatus` 从 `available` 改成 `restricted`。这是当前环境的嵌入播放限制，不推断作者关闭或原文删除。页面明确展示受限状态及原始链接。
- Instagram 帖子：31 / 31 在本站官方 iframe 中确认主内容图片已加载，`naturalWidth>0` 且显示宽度至少 200px。轮播只证明所展示图片的显示，不宣称所有轮播页均逐页测试。一次 J.Y. Park 帖子的鼠标关闭操作超时，图片显示已通过；增加单条复测后键盘关闭和 iframe 清理通过，原始结果及复测均保留。
- TikTok：使用官方 `https://www.tiktok.com/player/v1/{真实ID}?controls=1&description=1&music_info=1&autoplay=0`。先逐条确认官方播放器作者和原始视频链接，再在本站真实 iframe 点击原生播放控件。35 / 35 实际播放通过，且关闭后 iframe 清理、390px 无横向溢出。首次站内扫测 33 / 35 通过；另两条分别发生加载超时和 frame 导航中断，单条复测均通过，保留首次失败记录。
- 以上使用真实 Edge 浏览器和平台响应，没有用受控网络响应替代播放。结果仅代表核验环境和时点，平台、地区、网络或内容状态变化可能改变结果。

逐条证据均为文本和 DOM 状态，不保存媒体、签名 CDN 地址或完整第三方页面：

- [Instagram 视频 47 条与受限诊断](phase-3.1/instagram-playback.json)
- [Instagram 帖子 31 条显示](phase-3.1/instagram-posts.json)
- [TikTok 35 条站内播放](phase-3.1/tiktok-playback.json)
- [来源审计、排除作者及账号尝试](phase-3.1/source-review.json)
- [受控工程测试，单独标注非真实播放](phase-3.1/engineering-ui.json)

## 覆盖与未解决项

本轮检查全部 14 个 Instagram 官方账号公开嵌入所呈现的近期 6 条候选，并逐条核对原作者；额外补查已知历史链接。清单不是完整历史档案，也不是自动发现系统。没有遍历私有接口、绕过登录、验证码、429 或反自动化限制。

- YAOCHEN：JYP 旧目录 `noname_0323xx` 没有可用公开资料。改用已核实官方 YouTube [视频说明](https://www.youtube.com/watch?v=wX0nQwuBswA)中的完整 Instagram 出站链接 `yao_chen0323`，并核对原平台 YAO CHEN 姚琛 资料。当前公开 6 条均为纯图片轮播，已全部收录为帖子；视频数为 0。
- Stray Kids、ITZY、GIRLSET 等合作视频虽出现在艺人账号中，单条原作者分别存在 `bape.korea`、`duolingoespanol`、`trafalgarreleasing`、`youtubekorea`、`rei.ami` 等身份。未经对应账号官方身份及归属审核，不当成目标艺人原作者导入。DAY6 页面候选 `DeZSnWfgfuo` 原作者为已核实的 `xdinaryheroes_official`，归入 Xdinary Heroes。
- 新增 TikTok 映射 NiziU、NEXZ、BOY STORY、GIRLSET，证据为已核实艺人官方 YouTube 视频说明完整出站链接，保存在 `data/social/accounts.json`。前三组可核实视频的新增账号 NiziU、NEXZ、GIRLSET 各导入 5 条。BOY STORY 候选发现普通页面返回 HTTP 202 且没有可核实永久链接，普通网页搜索也未取得合格原文，保持 0 条；不推断该账号没有视频。
- DAY6、Xdinary Heroes、KickFlip、J.Y. Park、2PM、YAOCHEN 的 TikTok 官方身份尚未完成：每位审查一条独立官方 YouTube 视频说明，没有取得足够完整出站证据；不凭相似用户名认定账号。
- TikTok oEmbed 返回 HTTP 429（ratelimit triggered），Creator Profile 也出现 429（TLB/overload protect）。改用官方已知单条 Player 核验成功；账号预览位于内容库下方可选区域，不代替视频库。
- 所有新增内容均为 `manual-verified`，`official-embed` 是展示机制，不宣称内容由 API 自动发现。无可靠元数据的标题、描述及发布时间保持 null；无精确日期的内容稳定放在已知日期之后，不从 TikTok ID 推导时间。缩略图全部 null，图片和视频直接由官方嵌入加载。

## 文件、字段和读取链路

| 文件                                                     | 变更与作用                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `data/social/accounts.json`                              | 14 个 Instagram、8 个 TikTok 映射、证据、核验时间；YAOCHEN 修正                                      |
| `data/social/instagram/items.json`                       | 2 → 78；47 reels、31 post；视频 18 available / 29 restricted；帖子 31 available                      |
| `data/social/tiktok/items.json`                          | 0 → 35 short-video，均 available；完整证据与审核人                                                   |
| `data/status/instagram.json`、`tiktok.json`              | 导入更新各艺人 itemCount、newCount、updatedCount、成功时间和内容变更时间；模式仍为 manual-validation |
| `data/schemas/social.schema.ts`                          | 新增 video-post 类型，与 /p/、/reel/、TikTok URL 严格对应                                            |
| `scripts/social-sync/index.mjs`                          | 复用现有批量导入；video-post 要求 confirmedVideo=true；拒绝 exampleOnly 和类型冲突                   |
| `src/store/SocialContext.tsx`                            | 保留运行时 schema 读取校验；新增单一 activePlayerId，统一协调卡片与账号预览                          |
| `src/components/SocialCard.tsx`                          | 艺人、类型、未知日期、主动播放／查看、官方来源、收藏、关闭、可信消息和失败状态                       |
| `src/components/TikTokProfile.tsx`                       | 复用同一播放协调器，切换或关闭预览卸载内容                                                           |
| `src/pages/MediaPage.tsx`、`src/utils/social-library.ts` | 默认全部内容；独立视频／帖子筛选、搜索、确定日期排序，切换清理                                       |
| `src/locales/{zh-CN,en}.json`、`src/styles.css`          | 中英对应文案、类型筛选和移动端样式                                                                   |
| `tests/social-media.test.mjs`                            | URL 身份、伪造域名、重复批次、示例拒绝、视频声明、排序和真实清单完整性                               |
| `scripts/test-social-ui.mjs`                             | 可复现的受控工程回归，与真实播放证据区分                                                             |
| `scripts/verify-social-{playback,posts}.mjs`             | 手动发起的真实本站播放／图片显示验收；不发现或导入内容，不参与定时任务                               |
| `docs/examples/social-import.example.json`               | 防误发布批量样例；exampleOnly=true 会被导入器拒绝                                                    |
| `package.json`、`package-lock.json`、`.gitignore`        | playwright-core、本地验收命令和临时结果排除                                                          |

现有链路不另建副本：维护清单 → `scripts/stage-public-data.mjs` 运行时验证 → `public/data/social/{platform}/items.json`（构建生成，不提交）→ `dist/data/social/...` → `SocialContext.load` 以 BASE_URL 读取并再次验证 → `MediaPage` 筛选 → `SocialCard`。确认源清单与构建产物条数一致后才提交。当前生产页面不会因此变化，须人工审查后合并、发布才会进入线上。

## 可复现步骤与检查

使用 Node 24。在仓库根目录执行：

```sh
npm ci
node --test tests/*.test.mjs
npm run check
npm run build
npm run dev -- --port 5174
```

另一个终端执行（Windows 自动选择已安装 Edge；其他环境可设置 `BROWSER_EXECUTABLE`，或安装 Chrome；`BASE_URL` 可覆盖本地地址）：

```sh
npm run test:social:ui
npm run verify:social:playback -- --platform=tiktok
npm run verify:social:playback -- --platform=instagram
node scripts/verify-social-posts.mjs
```

真实播放默认只检查 `available` 视频，可加 `--artist=twice`、`--limit=1`、`--id=tt-...` 限定单条；Instagram 29 条 restricted 的完整首次测试和官方复核已存档，不自动重试平台限制。图片命令可加 `--id=ig-...`。脚本不自动下载浏览器、改写清单或声称跨地区可播，结果写入忽略的 `test-results/`。打开 `http://localhost:5174/seoul-os/#/media?artist=twice&platform=instagram` 或 `platform=tiktok` 查看；Archive 收藏后刷新验证持久化。

批量维护沿用已有命令：

```sh
npm run social:import -- --file=/absolute/path/reviewed-links.json --reviewer=MAINTAINER
npm run sync:social
npm run test:social
npm run build
```

`exampleOnly=true` 的样例不能直接导入。需要替换为真实链接、核验作者、证据、审核人；/p/ 的视频明确声明 `contentType: video-post`、`confirmedVideo: true`；普通图片／轮播声明 `post`。整批验证后写入、批内重复拒绝、跨次相同 ID 更新不重复。工具不替代真实作者审核。

本地结果：**50 / 50 Node 测试、TypeScript 检查、生产构建通过**；8 组浏览器工程回归通过。覆盖无同意零社交请求、Instagram 成功与 503、TikTok 可信 frame 消息与错误、未知名称／日期、图片分离、一次一条播放器、切换清理、375／390／412px 与 9:16、Instagram/TikTok 收藏刷新、原 Discover 50 条 YouTube 及收藏。受控测试明确标为非真实播放。原 YouTube 快照与同步脚本、艺人数据、Calendar 数据及工作流均未修改。

GitHub 检查：见 [PR #1 Checks](https://github.com/faxiusanda9-coder/seoul-os/pull/1/checks)，最终运行结果和提交号记录在 PR 正文；保持草稿等待人工验收。该检查执行全部 Node 测试与生产构建，不把受控测试或代码存在当作真实平台播放。

| 最终验收项         | 状态                           | 范围                                                                                                |
| ------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Engineering        | PASS（本地，GitHub 结果见 PR） | 测试、类型、构建、8 组浏览器回归                                                                    |
| Instagram Playback | PARTIAL                        | 18 / 47 视频真实播放；29 受限；31 / 31 帖子显示                                                     |
| TikTok Playback    | PASS                           | 35 / 35 本站真实播放，包含两条单独复测                                                              |
| Content Import     | PASS                           | 新增 111 条真实记录，覆盖全部 14 位艺人的 Instagram；完整历史和未核实 TikTok 账号仍不在本轮覆盖范围 |
