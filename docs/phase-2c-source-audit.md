# Phase 2C 仓库与来源接入审计

审查日期：2026-10-15。仓库：`seoul-os` 现有 main 检出。开始本任务时已有上一项 Content Taxonomy 工作的未提交修改，均为本次会话产生；没有覆盖其他分支或用户文件。

## 现有数据流与可复用部分

- YouTube：14 个独立官方频道快照，`scripts/youtube-sync.mjs` 经 `channels.list → playlistItems.list → videos.list` 同步，写入 `data/youtube/<artistId>.json`，构建时复制到 `/seoul-os/data/youtube/`。`ContentContext` 按所选艺人单频道读取，收藏 ID 是稳定的 `yt-<videoId>`。
- 分类：正在完成的 Content Taxonomy 统一内部类别 `music/stage/behind/notice/live/variety/fan/other`，并保留旧 `type` 供历史兼容。YouTube 分类 `notice` 仅代表 SEOUL.OS 对**视频**的语义判断，不代表 JYP 官网书面公告。
- 前端：React + HashRouter，中文默认字典；Discover、Artists、Artist Detail、Calendar、Archive、Search 已存在，可局部扩展。GitHub Pages 使用 Vite `base: /seoul-os/` 和独立部署工作流。YouTube 同步工作流在数据变化时显式调用 Pages 部署，避免 `GITHUB_TOKEN` 推送不触发部署的问题。

## 公告与日程现状

- 仓库尚无 `OfficialNotice`、官方公告来源表或 Notice 路由，也没有 JYP 官网公告同步器。YouTube 视频标题被分类为 `notice` 时，不能充当官网公告。
- `src/pages/CalendarPage.tsx` 默认真实活动数为 **0**。`src/data/events.ts` 仅存 2099 年的 6 条虚构演示活动，必须主动开启“显示演示活动”才出现。不可将它们用于真实日历或计算活动日期。
- Artist Directory 的部分 `officialUrl` 指向核验过的 JYP 艺人站点，其他指向 YouTube；官网 notice/schedule 深链接尚未独立核验。

## 最小实施与边界

1. 逐来源核验网站身份、匿名访问、稳定链接、Feed/API 是否明确开放、条款和自动访问限制；结果写入来源矩阵。技术可读性与授权依据分别记录。
2. 若无充分自动读取依据，只保存**核实过的官方页面入口**；不生成公告或行程 JSON，不添加会定时抓取页面的 Actions。
3. 建立独立的公告／活动类型与来源注册表，供未来经许可的适配器接入。Notice 页面展示真实来源链接及明确的“未启用自动同步”状态；Discover 提供入口，Calendar 提供官方日程入口与真实活动空状态。
4. X 账号须由 JYP 或艺人官网链接交叉确认。经确认的账号提供用户主动加载的 X 官方嵌入和外链；没有确认的账号不显示。第三方脚本失败不得影响其他内容。
5. 保持视频搜索、筛选、Archive 和图片系统。官方公告发布时间与未来活动日期分开，日期未知时留空。

初步风险：JYP 官网可能只通过客户端接口呈现，页面可公开访问也不等于允许自动抓取；X 嵌入在部分网络不可达；站点运营政策可能变化。后续矩阵会逐项标出证据与未核实项。

## 来源核验结论（2026-10-15）

实际点击官网导航确认了 JYP 公司公告、TWICE／Stray Kids／ITZY／NMIXX／DAY6／Xdinary Heroes／KickFlip／NEXZ 的 Notice 与 Schedule，NiziU 官网 NEWS。公开 Notice HTML 能看到标题、日期、分页和详情链接；Schedule 初始 HTML 在 2026 年选择器下仍出现 2025 AUGUST 表格，不能据此生产真实日程。[来源矩阵](jyp-official-source-matrix.md)逐项记录链接和状态。

公司及上述 JYP 子域的公开 `robots.txt` 允许普通页面但排除 `/api/`、`/_next/`；没有找到允许本项目定时采集、缓存并再发布公告数据的明确许可或官方 Feed。`robots` 对普通路径开放本身不构成再利用授权。因此所有已核实入口为 **B / 链接索引**，无 A 来源；未访问受限接口，也没有编写联网抓取器或 official-content-sync 工作流。当前真实官网公告、真实活动导入数量均为 **0**。

X 账号通过对应 JYP 艺人官网首页的社交链接核实 8 个。按[X 官方嵌入说明](https://help.x.com/en/using-x/embed-x-feed)设计用户主动点击加载；未核实账号不展示。嵌入能否在用户网络中成功加载不能从链接核验推出。
