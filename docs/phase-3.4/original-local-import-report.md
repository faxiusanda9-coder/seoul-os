# SEOUL.OS TikTok 本地导入报告

日期：2026-10-18（北京时间）。代码位于本机 `feat/tiktok-json-import` 分支，基于远端 `feat/brightdata-tiktok`；PR [#3](https://github.com/faxiusanda9-coder/seoul-os/pull/3) 仍为草稿，未推送本次改动、未合并、未部署。

## 结果

对上传的 `sd_mvdx30v5inbop8r5r (2).json` 全部 60 行逐条验证：57 条有效且稳定 post ID 无重复，3 条供应商失败。45 条新增到本地 TikTok 清单；12 条与已有人工记录 ID 相同，仅附加第三方采集证据，保留原人工属性和未知发布时间。清单由 35 条变为 80 条。所有有效记录保留规范原帖 URL、原发布时间、实际采集时间和快照 ID；播放器地址仅由 post ID 生成。未写入 `video_url`、CDN 链接、`tt_chain_token`、头像/预览链接或原始响应。描述字段按既有 Bright Data 适配器保持为空，不截断长文本或猜测标题。

以下“最新采集”均为原文件的 UTC 时间，非本次导入时间；“最新发布”是本次有效记录中的原始发布时间。

| 艺人 / 账号 | 输入 | 有效 | 新增 | 已有 ID | 失败 | 最新采集 UTC | 最新发布 UTC |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| ITZY / @itzyofficial | 10 | 9 | 9 | 0 | 1 | 2026-10-18 14:37:28.031 | 2026-10-16 05:00:00 |
| TWICE / @twice_tiktok_official | 10 | 9 | 5 | 4 | 1 | 2026-10-18 14:32:05.704 | 2026-10-15 09:00:34 |
| Stray Kids / @jypestraykids | 10 | 9 | 5 | 4 | 1 | 2026-10-18 14:42:37.746 | 2026-10-11 07:56:12 |
| NEXZ / @nexz_official | 10 | 10 | 10 | 0 | 0 | 2026-10-18 14:32:27.232 | 2026-10-18 13:00:00 |
| NMIXX / @nmixx_official | 10 | 10 | 6 | 4 | 0 | 2026-10-18 14:32:16.829 | 2026-10-18 11:28:00 |
| NiziU / @niziu_official | 10 | 10 | 10 | 0 | 0 | 2026-10-18 14:37:44.672 | 2026-10-18 08:01:46 |
| BOY STORY / @boystory_official_2018 | 0 | 0 | 0 | 0 | 0 | — | — |
| GIRLSET / @girlset | 0 | 0 | 0 | 0 | 0 | — | — |

## 失败与覆盖缺口

- 第 0 行：[ITZY 原帖](https://www.tiktok.com/@itzyofficial/video/7693500342285225237)，2026-10-18T14:27:42.394Z，供应商 `dead_page`。未导入，不能推断帖子已删除。
- 第 1 行：[TWICE 原帖](https://www.tiktok.com/@twice_tiktok_official/video/7696754928999517461)，2026-10-18T14:28:11.620Z，供应商 `dead_page`。未导入，不能推断帖子已删除。
- 第 2 行：[Stray Kids 原帖](https://www.tiktok.com/@jypestraykids/video/7692365601884425492)，2026-10-18T14:42:37.746Z，供应商 `wait_element_timeout`。未导入，不能推断帖子不存在。
- 本文件没有 BOY STORY、GIRLSET 记录；6 个账号每个只给出 10 行，不能据此断言历史完整、没有更多新帖或其他账号没有更新。现有定时脚本每账号每轮上限 8 条；高频发布、置顶内容或采集失败都可能形成缺口。
- 上传文件未发现字段名为 Bright Data API Token、API Key 或 Authorization 的字段；它含有其他临时令牌类字段，均未写入仓库。如果 Bright Data API Token 曾出现在聊天、截图、公开提交或其他共享位置，应在供应商控制台轮换，并仅以环境密钥保存。

## 播放验证

现有站内播放器使用 `https://www.tiktok.com/player/v1/{postId}`，无需持久化第三方签名视频链接。在本机站点用新增 NEXZ ID `7697867251575311668` 点击官方播放器，真实 iframe 创建，视频 `currentTime` 超过 0.5 秒且未暂停；原帖和账号链接均保留、播放器可关闭、390px 视口无横向溢出。此结果仅覆盖该样本及当时的浏览器/地区环境；其余帖子的可播性保持未测，不能标记为已播放。

## 本地改动与验证

仓库文件：

- `scripts/brightdata-tiktok/import-file.mjs`：新增本地文件导入；默认只预览，`--write` 才更新清单；逐条隔离供应商错误、按稳定 ID 去重、输出脱敏分账号报告。
- `scripts/brightdata-tiktok/adapter.mjs`：按实际响应将 `profile_username` 视为显示名；使用账号 ID、主页、原帖和发现输入核对作者。
- `tests/brightdata-tiktok.test.mjs`：覆盖显示名差异、失败隔离、重复 ID、人工记录保留及临时链接不落盘。
- `data/social/tiktok/items.json`：仅加入通过验证的本地元数据及第三方证据；未修改预算/状态文件。

验证：Bright Data 专项测试 21/21，通过；全量测试 89/89，通过（首次运行因旧依赖目录缺包失败，按锁定依赖 `npm ci` 后重跑通过）；生产构建通过；`git diff --check` 通过；再次预览导入新增 0、更新 0，说明重复运行不会扩张清单。构建保留已有的大包提示。

## 定时刷新剩余步骤

1. 审查此本地分支的清单与失败行，确定第三方公开元数据用途许可及供应商实际计费/免费硬停止条件；当前仓库合同仍标为未确认。不要从这份离线文件推断在线任务已经可用。
2. 将 PR #3 与最新 `main` 对齐并解决当前不可自动合并的状态；将本地改动经代码审查纳入该草稿 PR。本次未推送。
3. 在真实独占且零付费条件确认后，密钥只放 GitHub Actions Secret `BRIGHTDATA_API_TOKEN`，零付费核验证据放私密 `BRIGHTDATA_ZERO_COST_APPROVAL_JSON`，并设置受控变量 `BRIGHTDATA_TIKTOK_ENABLED`。如密钥有暴露，先轮换。
4. 按既有设置文档运行限定 ITZY 1 条的真实 probe，核对字段、账号、时间、账单和实际返回；现有本地文件不能代替 probe 或计费证据。再确认每轮 8 条、每日两次（北京时间 08:00/20:00）是否足以覆盖发布量，并制定失败行复核方式。
5. 完成审查与验证后，另取明确批准再合并/部署并启用定时刷新；首次在线运行后核对 Actions、预算台账、状态文件和站内数据。

