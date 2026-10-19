# 2026-10-19 晚间定时采集修复

北京时间 20:27:58，`schedule` 任务 [39252262735](https://github.com/faxiusanda9-coder/seoul-os/actions/runs/39252262735) 确实触发。TWICE 返回 8 条、没有新 ID；Stray Kids 的 Snapshot `sd_mvf8k6kl1cp52qqskx` 在 20:53 完成，返回 7 条正常视频和 1 条 `wait_element_timeout` 错误记录。旧逻辑把错误记录交给严格视频解析器，整批抛出 `BRIGHTDATA_RECORD_ERROR`，又将后续四团标记为 `STOPPED_AFTER_PROVIDER_FAILURE`。状态和 Pages 发布成功，视频清单仍为 84 条。不是未触发，也不是构建未部署；故障发生在已下载结果的逐条处理及失败隔离。

同一个 Snapshot 经 GET 复核，7 条正常视频均通过原作者、ID、域名、时间和视频类型校验。其中 `7698331929979997461` 尚未入库。错误记录不代表其原视频已删除，不能据此移除历史条目。

## 最小修复

- `scripts/brightdata-tiktok/adapter.mjs` 增加 `normalizeCollectedRows`：只分离带明确 `error` / `error_code` 的供应商失败记录，其余仍调用原 `normalizeRows`。原始总返回上限在过滤前检查，缺少身份、作者不符、畸形结构及冲突 ID 仍不通过。
- `scripts/brightdata-tiktok/sync.mjs` 仅导入合格内容，保留 `failedRecords` 证据。部分失败来源仍为 `state=failed`、`error=BRIGHTDATA_PARTIAL_RESULT`，记录实际新增数和总返回数，不伪报整个来源成功。成功读取的合格内容可推进 `lastSuccessAt`；全失败时不推进成功时间。已知、完整下载的单条内容错误不阻断其他账号。
- `src/components/BrightDataStatus.tsx` 和中英文文案明确显示“部分记录未通过 · 合格视频已处理”。没有新增伪造的可访问性或播放结果。
- 网络/API 请求失败、未解决任务、错误 Snapshot/作者、密钥、许可和预算问题继续安全停止。保留 4,000 月内部上限、$0 额外付费许可和持久化预留；不退款、不重复 POST、不删除账本。

`tests/partial-records.test.mjs` 覆盖混合结果入库后继续六团、全失败源保留旧数据而不阻断其他源、过滤不能隐藏错误作者、错误行不能绕过总返回上限。旧回归测试及数据校验保留。

## 验证与恢复

1. 在 Actions 运行详情下载 `brightdata-tiktok-summary`：核对 `failedRecords`、每团状态、请求和返回计数；不要把工作流触发等同于采集成功。
2. 恢复 Stray Kids 时只 GET 已知 Snapshot，复用已完成的 8 条预算预留，不重新创建采集任务。只发布 7 条合格记录中尚不存在的 ID，保留失败来源状态与证据。
3. 通过默认分支的手动 `sync` 补查本时段尚未预留的四团。TWICE 和 Stray Kids 已预留，自动跳过，不重新消耗其返回预算。
4. 检查线上 `data/social/tiktok/items.json` 的唯一 ID 和旧对象保留情况；检查 `data/status/brightdata-tiktok.json` 的真实时间、计数、部分失败标识；最后确认复用 Pages 部署成功和页面实际读取。

每日北京时间 08:00、20:00 的 cron 和独立开关不变。此次 schedule 已观察到触发；部分失败和后续人工补查应分别报告，不把补查冒称原定时任务成功。
