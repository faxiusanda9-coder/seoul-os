# Prompt 002B-C 内容分类最终报告

实施日期：2026-10-15。先完成的审计见 [content-taxonomy-analysis.md](content-taxonomy-analysis.md)。本报告描述 **YouTube 视频**的 SEOUL.OS 编辑分类，不把它等同于 JYP 官网公告。

## 原因与改动

原 UI 固定提供 MV、直播、公告等选项，旧快照的 `type` 仅由少量标题关键词生成，某些频道实际没有对应内容。用户点击后空白，分类选项也没有真实计数。

- `src/utils/contentClassifier.ts` 建立 `music / stage / behind / notice / live / variety / fan / other` 八类及可选 `subcategory`、规则 ID、方法和置信度。置信度是编辑规则强弱指标，不是概率；`other` 收纳证据不足的标题。
- 优先级由具体语义覆盖泛词：`MV Behind` → behind；巡演花絮优先作为幕后／综艺语义，不按「tour」推断售票；`MV Teaser` 不当作已发行 MV。仅取描述首条非模板文本辅助分类。
- `data/schemas/content.schema.ts` 将快照版本升至 3，同时继续读取旧 v1/v2。`scripts/youtube-sync.mjs` 在已获取的公开视频元数据上分类，不增加 API 请求。`scripts/backfill-taxonomy.mjs` 离线、幂等地回填 14 个频道快照，稳定 `yt-<videoId>` 与原始标题、链接不变。
- `ContentContext` 兼容旧快照即时推导分类；Discover/Search 的分类选项从**当前频道、当前搜索命中**计算，零条类别隐藏，切换搜索或艺人后不可用选项自动回到“全部”。Feed 卡片和 Archive 显示分类，但 Archive 文件夹字段保持原含义。
- `src/components/ContentCategorySelect.tsx` 复用计数和中英文字典；空搜索保留明确提示与清除筛选动作。

## 真实快照样本与限制

对 14 个独立频道各 50 条已存视频（合计 700 条）回填 v3，未联网、未产生 YouTube 配额。TWICE 50 条的当前规则结果：`other 34 / variety 7 / behind 5 / stage 3 / fan 1 / notice 0 / music 0 / live 0`。因此 TWICE 页不提供空的公告视频、音乐、直播选项。曾把 12 条黑胶唱片宣传和倒计时短片误判为公告视频；抽样发现后已删除泛化的 `special vinyl / teaser / D-2` 规则，改归 `other`。`other` 偏多主要因为短视频标题缺少可确认语义；符合“宁愿 other 也不误分类”的原则。真实官网资讯入口见 Phase 2C。

没有把 YouTube API 的 `snippet.categoryId` 冒充 K-pop 分类；规则属于 SEOUL.OS。分类在未来新增视频时可能变化，仍需抽样编辑审查。当前没有 AI、账号或数据库，也没有跨频道公开聚合时间线。

## 测试结果

- `npm run test:taxonomy`：4/4，通过规则冲突、模板描述、700 条快照 schema 与旧版本读取。
- `npm run test:sync`：9/9，通过 API 失败保留、幂等、跨频道故障隔离、失效数据处理。
- `npm run test:i18n`：1/1，字典键与参数一致。
- `npm run check` 与 `npm run build`：通过。
- Playwright 本地 Edge 验证 375px 与 1440px：TWICE 分类计数对应 50 条，舞台筛选 3 条；搜索 Behind 5 条，空搜索可清除；Archive 收藏与刷新仍在；无页面异常横向溢出或脚本错误。误判修正规则后的终轮结果见 [Phase 2C 测试报告](phase-2c-test-results.md)。浏览器检查为本地构建，线上部署另见 Phase 2C 报告。

后续可在获得更多有明确语义的官方元数据后扩充规则，并对 `other` 高比例频道做人工抽样，不应强行将模糊标题归类。
