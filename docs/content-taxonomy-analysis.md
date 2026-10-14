# SEOUL.OS 内容分类现状分析

审查日期：2026-10-15。编码前记录；基于仓库 `bc554e0` 的现有实现及已提交频道快照。

## 当前数据流

YouTube `channels.list` → uploads `playlistItems.list` → `videos.list(part=snippet,status)` → `scripts/youtube-sync.mjs` 的 `normalizeVideo` → `data/youtube/<artistId>.json` → `scripts/stage-public-data.mjs` 复制到 `public/data/youtube/` → `src/store/ContentContext.tsx` 转成 `FeedItem` → `src/utils/feed.ts` 筛选 → `FeedFilters` / `FeedCard` / 搜索页。

## 问题与涉及文件

| 问题 | 现状与证据 | 文件 |
| --- | --- | --- |
| 原始数据与分类混用 | `videos.list` 返回标题和描述；同步器用 `typeFromTitle(title)` 写入 5 种旧 `type`，未读取描述，也无分类依据或置信度。 | `scripts/youtube-sync.mjs`、`data/schemas/content.schema.ts` |
| 类别语义不足 | `ContentKind` 是 `music-video/performance/teaser/announcement/other`；前端 `ContentType` 另有 `Comeback/Live`，与同步器输出不对齐。`FeedItem.category` 实际是 Archive 文件夹，不是内容分类。 | schema、`src/types.ts`、`src/store/ContentContext.tsx` |
| 固定空选项 | `FeedFilters` 展示 `src/data/feed.ts` 中固定的八项；不统计当前频道内容。`selectFeed` 按旧 `item.type` 比较，点击数量为零的项目直接得到空列表。 | `src/components/FeedFilters.tsx`、`src/utils/feed.ts`、`src/pages/DiscoverPage.tsx` |
| 搜索不支持分类 | 搜索页只按当前频道文本匹配，显示条数但没有当前搜索结果的类别分布与二次筛选。 | `src/pages/SearchPage.tsx` |
| 存量数据 | 14 个频道各有独立 JSON。TWICE 当前 50 条中，旧 `type` 为 `other` 44、`performance` 3、`teaser` 3。大量短视频标题没有足够语义，不能强行猜测。 | `data/youtube/*.json` |

## 修改方案

1. 建立独立、可单测的规则分类器，输入保留原样的标题与描述，输出 `category`、可选 `subcategory`、`classification.method/confidence/ruleId`。用优先级处理 `MV Behind` 等冲突；广告链接和频道固定描述不得成为类别依据。`other` 是可信的“不足以判断”，不强制归类。
2. 快照 schema 升为 v3；保留旧 `type` 字段、稳定 `yt-<videoId>` 和完整原始标题/截断描述。v1/v2 读取兼容；同步器调用同一分类器，离线迁移已有快照，避免新增 API 调用。
3. 前端为内容分类新增独立 `contentCategory` 字段；保留 `FeedItem.category` 作为 Archive 文件夹。当前频道和搜索结果各自统计类别，筛选器只显示有内容的类别及数量。搜索词变化后若当前类别消失，自动回到“全部”；真正无结果时提供可用的重置操作。
4. 用现有中文和英文文案字典呈现类别；保留杂志式排版、频道隔离、收藏、GitHub Pages 子路径和 YouTube 原始链接。
5. 测试分类器冲突案例、TWICE 50 条人工抽检、v1/v2 兼容、重复同步幂等、真实数据 UI 筛选／搜索、收藏持久化和部署访问。

本阶段的 `classification.confidence` 是规则强度的产品指标，未经概率校准；不得向用户呈现为 YouTube 官方分类或统计学上的正确率。频道之间仍不生成聚合数据。
