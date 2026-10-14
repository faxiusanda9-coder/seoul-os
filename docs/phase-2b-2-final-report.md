# SEOUL.OS Phase 2B-2 最终验收报告

核验日期：2026-10-14（北京时间）。本报告区分真实 API / 公开 Pages / 模拟故障测试，不能把单次手动运行视作长期定时稳定性证明。

## 结论

**PARTIAL：14 个已上线独立艺人频道的取数、发布与浏览功能通过实测；YouTube 对同一公开粉丝站内多频道导航的政策解释、Git 历史和 Pages 构建产物的元数据留存期限，尚未取得个别确认。** 网站未发布跨频道合并 JSON、公开统一视频时间线、排行或统计。功能链路已经可用，政策待确认项不能表述为已获授权。

站点：[SEOUL.OS](https://faxiusanda9-coder.github.io/seoul-os/)。仓库：[faxiusanda9-coder/seoul-os](https://github.com/faxiusanda9-coder/seoul-os)。

## 已启用的独立艺人频道

频道官方链接与前期证据见 [Phase 2A 数据源计划](phase-2-data-plan.md)。本轮同步再次用 `channels.list` 对照频道 ID 与 uploads playlist ID，并用 `videos.list` 核对每个公开视频的 `channelId`、状态、原始标题、发布时间及缩略图。以下条数来自 2026-10-14 手动同步，不代表全部历史视频或实时更新保证。

| 艺人 | 已核实 channelId | 独立 JSON | 公开记录 |
| --- | --- | --- | ---: |
| TWICE | `UCzgxx_DM2Dcb9Y1spb9mUJA` | `twice.json` | 50 |
| Stray Kids | `UC9rMiEjNaCSsebs31MRDCRA` | `stray-kids.json` | 50 |
| ITZY | `UCDhM2k2Cua-JdobAh5moMFg` | `itzy.json` | 50 |
| NMIXX | `UCnUAyD4t2LkvW68YrDh7fDg` | `nmixx.json` | 50 |
| DAY6 | `UCp-pqXsizklX3ZHvLxXyhxw` | `day6.json` | 50 |
| Xdinary Heroes | `UCO9GhtdQcCRf67GIdSQ0HNQ` | `xdinary-heroes.json` | 50 |
| KickFlip | `UCmq9jjpHA69PwAwlA0DwOsg` | `kickflip.json` | 50 |
| NiziU | `UCHp2q2i85qt_9nn2H7AvGOw` | `niziu.json` | 50 |
| NEXZ | `UC-o9yrZxu5Ru-DVGhnmeTug` | `nexz.json` | 50 |
| J.Y. Park | `UCJzd6hPg7Iz35SkBNzAjjWQ` | `jy-park.json` | 50 |
| 2PM | `UCBpzJvEhkemwMOkYLq9yUsA` | `2pm.json` | 50 |
| BOY STORY | `UCZlgP_2MRnrPXRmqR5320BQ` | `boy-story.json` | 50 |
| YAOCHEN | `UCotuyOt3sduFSaL80X_tEVA` | `yaochen.json` | 50 |
| GIRLSET | `UCSskmnvIhEy3nSZxxVKTeIg` | `girlset.json` | 50 |

共 14 个独立文件、700 条记录，已检查每个文件的频道对应关系、公开视频状态和本文件内 ID 唯一性。对全部 700 条稳定 ID 的本地校验结果：700 个唯一 ID，无跨频道重复。`JYP Entertainment` 主频道的 ID 有官方来源，但它不是单个艺人频道，因此配置保留、同步禁用；`CIIU` 频道仍待核实，未启用。没有根据标题猜测视频属于哪个艺人。

## 同步与部署的真实运行记录

已有的 `YOUTUBE_API_KEY` GitHub Actions Secret 可用；本轮没有读取或输出明文。所有手动同步均由 GitHub Actions 实际访问 YouTube Data API。每个新频道都是 3 次请求、0 次重试；每批已存在频道刷新检查没有重复记录。

| 批次 | GitHub Actions 运行 | 本次启用新频道 | 结果 | 请求数 / 估算 quota units |
| --- | --- | --- | --- | ---: |
| A | [38569561371](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38569561371) | TWICE 基线、Stray Kids、ITZY | 3/3 成功；同步提交 `1bc7bd4`；Pages 部署成功 | 9 / 9 |
| B | [38570490479](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38570490479) | NMIXX、DAY6、Xdinary Heroes | 6/6 成功；同步提交 `d8028db`；Pages 部署成功 | 18 / 18 |
| C1 | [38571160782](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38571160782) | KickFlip、NiziU、NEXZ | 9/9 成功；同步提交 `cb71db7`；Pages 部署成功 | 27 / 27 |
| C2 | [38571716917](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38571716917) | J.Y. Park、2PM、BOY STORY、YAOCHEN、GIRLSET | 14/14 成功；同步提交 `dee58ba`；Pages 构建 14 份快照并部署成功 | 42 / 42 |
| 无变化复核 | [38572029858](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38572029858) | 只检查 TWICE | 50 条，新 0、更新 0；无提交；部署 Job 跳过 | 3 / 3 |

上述五次手动运行合计 **99 次 API 请求，按官方列表方法单价估算 99 quota units**。这不是 Google Cloud Console 实测用量，也不包括此前阶段的调用或将来的失败重试。定时触发在默认分支上配置为 UTC 00:00 / 12:00，即北京时间 08:00 / 20:00；长期准点率需在真实定时周期后继续观察。

[GitHub Pages 的 TWICE JSON](https://faxiusanda9-coder.github.io/seoul-os/data/youtube/twice.json)、[Stray Kids JSON](https://faxiusanda9-coder.github.io/seoul-os/data/youtube/stray-kids.json) 和 [GIRLSET JSON](https://faxiusanda9-coder.github.io/seoul-os/data/youtube/girlset.json) 均实测返回 200；其余 11 个独立 JSON 也逐一实测为 200 且每个 50 条。Pages 发布后曾短暂返回旧版本 404，随后传播完成；前端对暂时失败会展示标记清楚的样本或空态，并提供重试。

## 稳定性与收藏

- 同步器按频道独立读取、校验和原子写入；一个频道的 API 错误不会覆盖其他频道。模拟测试涵盖单频道 HTTP 500、损坏的旧 JSON、缺少密钥、重复同步、私密视频剔除与 30 天过期数据清理。这些是 **Mock API 故障测试**，不冒充真实服务故障。
- `yt-<videoId>` 是收藏主键，继承旧的 `seoul-os-archive-v1`。浏览器实测：旧 TWICE 收藏进入 Archive；新 Stray Kids 视频收藏、刷新后仍在；不同频道的收藏按艺人分开查看；关注 GIRLSET、刷新后 My Space 仍有、取消关注后同步消失。无账号或跨设备同步。
- 前端读取某个频道 JSON 失败时会做一次短间隔重试；再次失败时显示回退状态及可点击的重试操作。Playwright 在本地故意中断前两次请求、第三次放行，证实回退和手动重试能恢复 50 条真实快照。发布站点曾有一次桌面端请求超时，重跑成功，说明网络失败仍可能发生；现已增加前端有限重试。
- 公开页面不会一次加载全部 14 个频道视频。Discover 仅显示当前频道，艺人详情仅显示对应频道；搜索、类型筛选、时间排序作用于当前频道。Archive 只存浏览器个人收藏意图，不构造公开合并结果。

## 验证项目

| 检查 | 结果 |
| --- | --- |
| `npm run test:sync` | 8/8 通过；Mock API 覆盖去重、缺少密钥、失败隔离、失效处理 |
| `npm run test:i18n` | 1/1 通过；中英文 key 与参数一致 |
| `npm run check` | TypeScript 无错误 |
| `npm run build` | 成功；14 个独立快照进入发布目录；约 504 KB JS chunk 警告，不阻止运行 |
| Playwright 手机与桌面 | 375×812、1440×900：14 个独立艺人页面、筛选、搜索空态、排序、旧/新收藏、关注与取消、刷新持久化、控制台和横向溢出检查通过 |
| 其他屏宽 | 360、390、412、768：底部导航、14 张艺人卡片、路由选中态、横向溢出与脚本错误检查通过；其中 768px 曾发现长标题导致页面横向溢出，已为动态标题补充任意位置换行并重测通过 |
| GitHub Pages | `/seoul-os/` 及各频道静态 JSON 实际访问通过；`HashRouter` 子页面刷新可用 |

## 配额和费用

[YouTube `channels.list`](https://developers.google.com/youtube/v3/docs/channels/list)、[`playlistItems.list`](https://developers.google.com/youtube/v3/docs/playlistItems/list)、[`videos.list`](https://developers.google.com/youtube/v3/docs/videos/list) 官方文档均列每请求 1 unit。14 个频道 × 3 次请求 × 每天 2 次 = **84 units/日基础估计**，另计失败重试或将来新增分页。YouTube 文档描述默认每日 10,000 units，但该项目的实际额度需在 Google Cloud Console 查看；本轮没有创建付费资源或第三方聚合服务。GitHub Pages 与 Actions 仍需遵守仓库账户自身额度及服务条款。

## 合规核对与未解决问题

详细说明见 [Phase 2B-2 合规边界](phase-2b-2-compliance.md)。[YouTube Developer Policies III.E.2](https://developers.google.com/youtube/terms/developer-policies) 限制 API Data 聚合：即使多个频道归属同一公司，也不能直接推定允许公众查看合并数据。本应用仅提供逐频道视图，没有公开混排 Feed、跨频道排行或统计。作品原始标题不覆盖为机器翻译；类型是 SEOUL.OS 自定义编辑分类。同步检查 public 状态，快照超过 30 天且无法刷新时从当前发布目录删除，Archive 只留最小收藏 ID。

**仍需确认：** YouTube 是否将同一公开网站的多频道导航解释为受限聚合；已经提交的 Git 历史与旧 Pages 构建产物是否构成超出 30 天的元数据留存，以及如何清理。当前代码只限制最新工作树和当前发布文件的过期元数据，**不能声称历史版本已经被删除**。不建议上线跨频道公开合并功能；若要推进，应取得适用于公众展示的明确授权或平台书面确认，并设计能证明历史缓存按政策到期删除的数据发布方式。

## 下一步

1. 观察实际两次定时任务，记录延迟、失败与额外配额；本轮手动成功不能代替长期稳定性。
2. 就多频道导航的政策边界与历史缓存留存寻求平台明确确认，并调整数据发布生命周期。
3. 持续核对官方频道链接、公开视频状态和缩略图可用性；任何失效数据按现有过期策略处理。
4. 在上述合规问题解决前，继续保留当前单频道切换模式；不启动跨频道公开聚合、数据库或付费服务。
