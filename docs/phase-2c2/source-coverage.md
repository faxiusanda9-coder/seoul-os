# 事件来源覆盖率：2026-10-15

## Ticketmaster Discovery

本地环境没有 `TICKETMASTER_API_KEY`；[首次日历工作流](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662672492)日志记录 `credentialConfigured=false`，说明该次 Actions 运行亦未取得 Ticketmaster Secret。官方 Discovery API 要求 `apikey`，无密钥时返回 401。`npm run calendar:coverage` 实际结果：注册表 14 位艺人，**API 调查 0 位、已核实 Attraction ID 0 个、未来活动实际查询 0 次、真实返回 0 条、已发布 0 条**。“0 条”代表尚未查询，不能解释为不存在演出。不能据艺人名称把搜索候选自动升级为核实身份。

| artistId | 艺人 | Attraction ID | 身份状态 | 未来活动查询 |
|---|---|---|---|---|
| twice | TWICE | 未核实 | 待密钥及人工核验 | 未运行 |
| stray-kids | Stray Kids | 未核实 | 同上 | 未运行 |
| itzy | ITZY | 未核实 | 同上 | 未运行 |
| nmixx | NMIXX | 未核实 | 同上 | 未运行 |
| day6 | DAY6 | 未核实 | 同上 | 未运行 |
| xdinary-heroes | Xdinary Heroes | 未核实 | 同上 | 未运行 |
| kickflip | KickFlip | 未核实 | 同上 | 未运行 |
| niziu | NiziU | 未核实 | 同上 | 未运行 |
| nexz | NEXZ | 未核实 | 同上 | 未运行 |
| jy-park | J.Y. Park | 未核实 | 同上 | 未运行 |
| 2pm | 2PM | 未核实 | 同上 | 未运行 |
| boy-story | BOY STORY | 未核实 | 同上 | 未运行 |
| yaochen | YAOCHEN | 未核实 | 同上 | 未运行 |
| girlset | GIRLSET | 未核实 | 同上 | 未运行 |

注册表 `data/calendar/ticketmaster-artists.json` 不为任何艺人猜测 ID。密钥取得后先运行 `npm run calendar:coverage` 获取待审候选，逐一核对 Ticketmaster Attraction 页面、艺人官方身份与相关活动；记录证据和时间后才将 `mappingStatus` 设为 `verified`。Ticketmaster 覆盖地区有限；未搜索到不等于没有活动。

## JYP 官网与 YouTube

JYP 官网 8 个艺人 Schedule 入口此前已核实，当前仍是链接索引；没有自动读取和再发布许可，不抓取。YouTube 已核实 14 个启用频道。[独立 TWICE 试点运行](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/38662893635)使用现有 Actions Secret 实际执行 `videos.list` **1 次**，检查当前上传快照的 **50 个 videoId**，返回 **50 个公开视频资源、0 条符合条件的 upcoming 直播**。这只证明所查快照中没有候选；uploads playlist 不保证包含所有预约直播，试点不能证明完整覆盖。试点不写公共跨频道日历；公司频道、CIIU 不参与艺人自动匹配。

核查依据：[Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)、[官方 FAQ](https://developer.ticketmaster.com/support/faq/)、[JYP 官网来源矩阵](../jyp-official-source-matrix.md)。
