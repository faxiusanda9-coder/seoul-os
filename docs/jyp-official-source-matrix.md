# JYP 官方公告、行程与社交来源矩阵

Phase 3 补充（2026-10-17）：Instagram 官方账号覆盖 14 位已启用艺人，TikTok 确认 4 位；逐条核验来源见 `data/social/accounts.json` 与 [Phase 3 覆盖及接口调查](phase-3-official-media.md)。八个 jype 艺人站的作品目录导航已核实，`OfficialSource.releaseUrl` 仅提供 `/discography` 外链。下方 Phase 2C 分类仍描述官网公告/行程读取权限，不代表 Instagram/TikTok 获得自动发现授权。

核验日期：2026-10-15（北京时间）。本矩阵记录**页面入口和使用方式**，不代表获得网页内容的复制／自动采集许可。`A`＝有足够自动使用依据，`B`＝只开放核实的官网链接，`C`＝身份或条件待核实，`D`＝不可用。当前 **A=0，B=10 个来源（公司及 9 位艺人），C=5 位艺人加 CIIU**。所有 B 来源 `automationAllowed=false`，`lastCheckedAt=2026-10-15`，只提供外链。

| artistId | 官方 Notice / News | 官方 Schedule | sourceType / accessStatus / dataAvailability | 分类、authorizationBasis、reason / evidenceUrl |
|---|---|---|---|---|
| jyp-company | [JYP 公司公告](https://www.jype.com/ko/board/notice) | 未见统一公司行程 | jyp-site / public / notice-only | B：公司站导航已确认；未找到自动采集再发布许可；[公告页](https://www.jype.com/ko/board/notice) |
| twice | [Notice](https://twice.jype.com/notice) | [Schedule](https://twice.jype.com/schedule) | jyp-site / public / notice-and-schedule | B：艺人官网导航已确认；无自动使用许可；[官网](https://twice.jype.com/) |
| stray-kids | [Notice](https://straykids.jype.com/notice) | [Schedule](https://straykids.jype.com/schedule) | jyp-site / public / notice-and-schedule | B：艺人官网导航已确认；无自动使用许可；[官网](https://straykids.jype.com/) |
| itzy | [Notice](https://itzy.jype.com/notice) | [Schedule](https://itzy.jype.com/schedule) | jyp-site / public / notice-and-schedule | B：艺人官网导航已确认；无自动使用许可；[官网](https://itzy.jype.com/) |
| nmixx | [Notice](https://nmixx.jype.com/notice) | [Schedule](https://nmixx.jype.com/schedule) | jyp-site / public / notice-and-schedule | B：艺人官网导航已确认；无自动使用许可；[官网](https://nmixx.jype.com/) |
| day6 | [Notice](https://day6.jype.com/notice) | [Schedule](https://day6.jype.com/schedule) | jyp-site / public / notice-and-schedule | B：艺人官网导航已确认；无自动使用许可；[官网](https://day6.jype.com/) |
| xdinary-heroes | [Notice](https://xdinaryheroes.jype.com/notice) | [Schedule](https://xdinaryheroes.jype.com/schedule) | jyp-site / public / notice-and-schedule | B：艺人官网导航已确认；无自动使用许可；[官网](https://xdinaryheroes.jype.com/) |
| kickflip | [Notice](https://kickflip.jype.com/notice) | [Schedule](https://kickflip.jype.com/schedule) | jyp-site / public / notice-and-schedule | B：导航有效；Notice 可为空，不视为采集成功；[官网](https://kickflip.jype.com/) |
| nexz | [Notice](https://nexz.jype.com/notice) | [Schedule](https://nexz.jype.com/schedule) | jyp-site / public / notice-and-schedule | B：艺人官网导航已确认；无自动使用许可；[官网](https://nexz.jype.com/) |
| niziu | [NEWS](https://niziu.com/s/n123/page/news) | 无统一 Schedule；官网有 [LIVE 专题](https://niziu.com/s/n123/page/livewithu2026_2027) | artist-site / public / notice-only | B：NiziU 官网导航提供 NEWS；LIVE 专题不是结构化日历；无自动转载许可；[官网](https://niziu.com/) |
| boy-story | 待核实 | 待核实 | none / unverified / none | C：现有档案只有已核实 YouTube 入口，未从官方站核实独立公告／行程；不展示猜测链接。 |
| girlset | 待核实 | 待核实 | none / unverified / none | C：同上。 |
| 2pm | 待核实 | 待核实 | none / unverified / none | C：同上。 |
| jy-park | 待核实 | 待核实 | none / unverified / none | C：同上。 |
| yaochen | 待核实 | 待核实 | none / unverified / none | C：同上。 |
| CIIU | 待核实 | 待核实 | none / unverified / none | C：Phase 2A 频道尚待验证，不能猜测其官网或启用任何同步。 |

## 技术与使用条件审计

- JYP 公司和上述 JYP 艺人站的 Notice 列表可匿名读取，标题、页面日期、详情入口及分页可在公开 HTML 中观察到。例如 [TWICE Notice](https://twice.jype.com/notice)、[Stray Kids Notice](https://straykids.jype.com/notice)、[ITZY Notice](https://itzy.jype.com/notice)。这说明**人可浏览**，不说明允许机器持续抓取、缓存或再发布。
- JYP 公司及 8 个艺人子域的 `robots.txt` 于 2026-10-15 直接访问均返回 `User-Agent: *; Allow: /; Disallow: /api/; Disallow: /_next/`。示例：[TWICE robots.txt](https://twice.jype.com/robots.txt)、[公司 robots.txt](https://www.jype.com/robots.txt)。未尝试访问排除的接口；Allow 页面本身仍不授予数据再利用许可。官网页脚为版权保留声明。未发现官方公开 Feed/RSS 或明确允许本项目定时同步、复制标题的条款，因此不启动联网适配器与 Actions。
- [TWICE Schedule](https://twice.jype.com/schedule)、[Stray Kids Schedule](https://straykids.jype.com/schedule)、[ITZY Schedule](https://itzy.jype.com/schedule) 等公开页有年月切换，但已观察到初始 HTML 内同时出现 **2026 年选择器和 2025 AUGUST 表格**。单凭首屏 HTML 无法确定当前月份或活动实际日期。日历保持真实活动 0 条；不将公告发布时间挪作演出日期，不对仅有日期的项目补造时刻。
- [NiziU 官网](https://niziu.com/)导航提供 NEWS、LIVE，亦有付费 FANCLUB。本站只链接公开 NEWS；[粉丝俱乐部使用条款](https://fc.niziu.com/s/n120/rule)限制未经许可的转载／积累，会员内容完全不接入。NEWS 可公开查看，但未核实定时读取许可。
- 官网 Notice 既有预告、MV，也有正式通知。例如 [DAY6 Notice](https://day6.jype.com/notice) 可见生日、MV 和专辑帖子；不能把来源栏目名直接等同于“重要公告”。`src/utils/officialClassifier.ts` 为未来**取得许可后**的元数据保留保守语义规则，当前不对官网帖子执行联网分类。

## X 官方账号

账号来自对应 JYP 艺人官网首页 HTML 的官方社交链接，均在 `src/data/officialSocialAccounts.ts` 记录 `verifiedBy/verifiedAt`。当前核实：TWICE `@JYPETWICE`、Stray Kids `@Stray_Kids`、ITZY `@ITZYOfficial`、NMIXX `@NMIXX_official`、DAY6 `@DAY6Official`、Xdinary Heroes `@XH_official`、KickFlip `@kickflip_jype`、NEXZ `@NEXZ_official`。NiziU、BOY STORY、GIRLSET、2PM、J.Y. Park、YAOCHEN 的 X 入口未从对应艺人官网完成核实，不显示。

[X 官方嵌入说明](https://help.x.com/en/using-x/embed-x-feed)允许将公开账号时间线以官方 widget 嵌入，同时要求遵守其[开发者政策](https://docs.x.com/developer-terms/policy)。政策的公开展示章节要求告知访问数据收集和提供退出方式；因此本站在用户点击前说明 X 可能接收页面、IP、浏览器及 Cookie 信息，并链接[X 隐私与退出说明](https://help.x.com/en/rules-and-policies/x-cookies)。点击同意后才加载 X 脚本，widget 请求设置 `dnt=true`；不调用 X API，也不保存帖文。部分地区可能无法加载，界面保留原账号链接；官方账号身份与嵌入成功是不同验证项。
