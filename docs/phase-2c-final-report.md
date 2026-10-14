# SEOUL.OS Phase 2C-1 最终验收报告

日期：2026-10-15（北京时间）。仓库：[`faxiusanda9-coder/seoul-os`](https://github.com/faxiusanda9-coder/seoul-os)。本轮同时完成 Prompt 002B-C 视频分类，详见[分类报告](content-taxonomy-final-report.md)。优先目标是来源真实性，因此官方网页自动同步在缺少充分许可时保持关闭。

## 1. 数据源覆盖与真实结果

[完整来源矩阵](jyp-official-source-matrix.md)记录每项 `artistId / noticeUrl / scheduleUrl / sourceType / authorizationBasis / accessStatus / dataAvailability / automationAllowed / lastCheckedAt / reason / evidenceUrl`。2026-10-15 核验结果：

| 艺人／公司 | Notice | Schedule | 方式与原因 |
|---|---|---|---|
| JYP Entertainment | [有](https://www.jype.com/ko/board/notice) | 未见统一入口 | B：仅官网链接；无自动采集与再发布许可依据。 |
| TWICE | [有](https://twice.jype.com/notice) | [有](https://twice.jype.com/schedule) | B：两个链接均来自官方导航；不采集。 |
| Stray Kids | [有](https://straykids.jype.com/notice) | [有](https://straykids.jype.com/schedule) | B：同上。 |
| ITZY | [有](https://itzy.jype.com/notice) | [有](https://itzy.jype.com/schedule) | B：同上。 |
| NMIXX | [有](https://nmixx.jype.com/notice) | [有](https://nmixx.jype.com/schedule) | B：同上。 |
| DAY6 | [有](https://day6.jype.com/notice) | [有](https://day6.jype.com/schedule) | B：同上。 |
| Xdinary Heroes | [有](https://xdinaryheroes.jype.com/notice) | [有](https://xdinaryheroes.jype.com/schedule) | B：同上。 |
| KickFlip | [有](https://kickflip.jype.com/notice)，可为空 | [有](https://kickflip.jype.com/schedule) | B：入口核实；空页不冒充公告。 |
| NEXZ | [有](https://nexz.jype.com/notice) | [有](https://nexz.jype.com/schedule) | B：同上。 |
| NiziU | [NEWS](https://niziu.com/s/n123/page/news) | 未见统一 Schedule | B：NEWS 可公开浏览；LIVE 是专题入口，不作为结构化日历。 |
| BOY STORY、GIRLSET、2PM、J.Y. Park、YAOCHEN、CIIU | 未核实独立官网 Notice | 未核实独立官网 Schedule | C：现有艺人资料／频道不证明公告入口；不显示猜测链接。 |

**官网书面公告实际导入：0 条；官方活动实际导入：0 条；覆盖的自动同步来源：0 个；发布时间范围／最近同步时间：不适用。** 页面只索引 10 个已核实官网来源，不将其卡片冒充公告条目。已有独立 YouTube 数据链路仍显示真实视频，本轮离线对 14×50 条快照建立 v3 视频分类；未增加 YouTube API 请求。

## 2. 使用条件与工程决策

JYP 网站的公开页面和分页可以阅读，但直接查询的 `robots.txt` 对 `/api/`、`/_next/` 设置排除；普通路径可访问也不等于获得定时提取、缓存和再发布许可。[TWICE 官网 robots.txt](https://twice.jype.com/robots.txt)、[公司 robots.txt](https://www.jype.com/robots.txt)及官网版权声明构成保守处理的依据。没有发现足够明确的官方 Feed/RSS 或书面授权，故没有创建 `official-content-sync.yml`、没有请求内部接口、没有生成虚构 notices/events JSON。NiziU 会员内容亦不接入。[来源审计](phase-2c-source-audit.md)说明了技术可读性与授权判断的区别。

`src/types/official.ts` 预留 `OfficialNotice`、`OfficialEvent`、`OfficialSource`、`OfficialSocialAccount`。公告发布日期与活动日期分开；日期精度、是否全天、是否确认时间均显式记录。`src/utils/officialClassifier.ts` 保存保守的未来公告语义规则，只有获得许可后的来源适配器才应使用。外部 URL 由已核实的域名／路径范围校验；前端不渲染未经信任的 HTML。

## 3. X 入口

从各自艺人官网首页的社交链接核实并启用 8 个账号：TWICE `@JYPETWICE`、Stray Kids `@Stray_Kids`、ITZY `@ITZYOfficial`、NMIXX `@NMIXX_official`、DAY6 `@DAY6Official`、Xdinary Heroes `@XH_official`、KickFlip `@kickflip_jype`、NEXZ `@NEXZ_official`。其他艺人账号未核实，不显示。

艺人详情页由用户主动点击同意后才尝试加载 X 官方 widget；点击前说明可能收集的页面、IP、浏览器、Cookie 信息并提供[X 隐私与退出设置](https://help.x.com/en/rules-and-policies/x-cookies)链接，widget 设置 `dnt=true`。不购买 X API、不保存帖子。实现依据为 [X 官方嵌入说明](https://help.x.com/en/using-x/embed-x-feed)与[开发者政策](https://docs.x.com/developer-terms/policy)。本地实际试验中，X iframe 被建立但始终高度 0，12 秒后显示失败说明与原账号链接；模拟网络阻断时同样正确降级。**本轮不能宣称 X 内嵌时间线已成功呈现**，但官方账号外链入口和失败处理已经上线。

## 4. 用户实际体验

- [Official Updates](https://faxiusanda9-coder.github.io/seoul-os/#/official)：选择 TWICE、Stray Kids、ITZY 或其他已核实艺人，点击“查看官网公告”；搜索／筛选的是**来源入口**，页面明确写明“未自动同步”。没有许可时不显示假公告，也不提供无数据的公告类型筛选。
- [Calendar](https://faxiusanda9-coder.github.io/seoul-os/#/calendar)：默认 0 条真实活动；下方有 8 个艺人官网行程链接。可主动开启 2099 年演示样例，其身份清楚标记。公告发布日期不会被当成活动日；目前没有可核实的站内活动日期。
- [Artists](https://faxiusanda9-coder.github.io/seoul-os/#/artists)：进入已核实艺人详情页，点击加载其 X 时间线；访问失败仍可打开官网核实的 X 账号。
- 首页视频仍按单一所选 YouTube 频道显示。八类视频标签与官网书面公告分开；当前频道实际为零的类别会隐藏。收藏 ID 和关注 localStorage 格式保持不变。

## 5. 工程变更与发布记录

核心新增：`src/pages/NoticePage.tsx`、`src/components/OfficialXTimeline.tsx`、`src/data/officialSources.ts`、`src/data/officialSocialAccounts.ts`、`src/types/official.ts`、`src/utils/officialClassifier.ts`、`src/utils/contentClassifier.ts`、`src/components/ContentCategorySelect.tsx`、`scripts/backfill-taxonomy.mjs`、两个新增测试文件与审计／报告。局部更新 Discover、Artist Detail、Calendar、Search、Archive、Layout 的次级路由选中状态、i18n、视频同步 schema／脚本及 README；未重做视觉主题。

现有 YouTube GitHub Actions 仍按北京时间 08:00、20:00 运行；本轮没有官方网页自动同步工作流。提交 [`a68cf3c`](https://github.com/faxiusanda9-coder/seoul-os/commit/a68cf3c6df29db2afd1477a268c6aa0e4b4a2083) 触发的 [Pages 部署运行 38608324768](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38608324768) 已于 GitHub Actions 显示 **success**。实际访问 [站点](https://faxiusanda9-coder.github.io/seoul-os/) 返回 200，脚本路径为 `/seoul-os/assets/index-B4VMXCO7.js`；[TWICE JSON](https://faxiusanda9-coder.github.io/seoul-os/data/youtube/twice.json) 返回 schema v3、50 条、稳定 `yt-` ID。HashRouter 的 `/#/official` 刷新已在生产浏览器验证。

## 6. 测试、成本及未解决问题

[完整测试记录和截图](phase-2c-test-results.md)：TypeScript 和构建通过；分类 4/4、官网 4/4、同步回归 9/9、语言 1/1；本地及生产 Playwright 检查 375、412、1440 宽度，官网入口／日历／X 失败降级无页面错误和横向溢出；生产 375、1440 验证分类、搜索与收藏刷新。构建有既存主包 >500 kB 的非阻断警告。

本轮新官网／X API 配额与云费用为 **0**；没有启用网页抓取、X API、付费服务。原有 YouTube 定时同步继续消耗其原配额，本轮回填调用 YouTube API **0 次**。未来维护主要是核实官网导航、社交账号和权限变更；实际定时稳定性不能由单次构建证明。

未解决：官网数据自动同步缺少明确许可，故 Notice 无站内真实帖子、Calendar 无站内真实活动；六个艺人／候选缺少可确认的独立公告入口；X iframe 在本地环境未成功显示；未来来源日期变更、撤销和时区逻辑需在真实获准数据接入后验证。下一步应优先取得 JYP 对元数据同步与展示的书面授权或官方开放 Feed/API，再小批量实现 Notice/Schedule 适配器和定时任务；不应以爬虫填补数量。

## 最终状态：PARTIAL

Prompt 002B-C 视频分类、官方链接索引、已核实 X 账号入口、Pages 发布与现有收藏回归均通过实测；**官方公告和真实活动的自动接入尚无许可基础，X 内嵌成功也未被证实**。此状态以线上运行、浏览器检查和来源矩阵为据，不把页面可访问当作采集许可。
