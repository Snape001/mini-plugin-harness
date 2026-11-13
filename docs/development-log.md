# MiniHarness 开发进度

**更新日期：** 2026-11-13
**状态：** 核心运行时、权限治理、MCP、Session 恢复及首轮可靠性加固已实现并通过当前环境验收。

MiniHarness 是基于 Cordis 的 TypeScript Agent Runtime。使用方式和配置示例见 [README](../README.md)。

## 已实现

- 插件：`logger`、`hooks`、`permission`、`llm`、`tools`、`skills`、`session`、`agent`；MCP 插件可选。
- 工具权限在 Runtime 注册时声明。执行共用入口依次执行 Hook、参数校验和权限检查；黑名单优先，危险操作逐次审批，普通写入默认拒绝。
- 文件工具限制在项目根目录，拒绝符号链接，读写使用文件句柄并校验打开对象；Session 数据对文件工具不可见。
- CLI 的 EOF、SIGINT、SIGTERM 取消当前任务；工具执行中的状态不确定调用记录为 `unknown`，恢复时不重放。Runtime 关闭幂等，CLI 清理最多等待 5 秒。
- Session 支持 `paused` 与 `interrupted` 恢复，旧 SQLite 数据库增量迁移。`maxIterations` 限制每段迭代，`maxTaskIterations`（默认 100）限制单任务总迭代。
- SQLite 保存工具调用参数/结果及每次尝试的耗时、状态、错误码和审批结果。只读执行失败有限重试，写入、危险操作、拒绝、超时和取消不重试。
- MCP 连接失败先按 1、2、4 秒重试，之后按约 30 秒（±20% 抖动）持续探测；连接恢复会重发现工具，Runtime 关闭时停止探测。缺少令牌的连接也会重试。
- `pnpm eval` 运行本地确定性故障场景并在 `.miniharness/evals/` 输出 JSON 报告，不请求真实模型或外部服务。

## 验收

- `pnpm exec tsc --noEmit`：通过。
- `pnpm test`：57 通过、4 跳过；Windows 下跳过 3 个符号链接/目录替换用例及 1 个 POSIX SIGTERM 集成用例。
- `pnpm eval`：5 个场景通过；报告写入 `.miniharness/evals/`。

## 后续注意

- 文件操作检查与使用之间仍存在并发替换目录的 TOCTOU 窗口；纯 Node 缺少跨平台目录句柄能力，当前通过拒绝符号链接、`O_NOFOLLOW`（平台支持时）和打开后校验缩小风险。
- `list_files` 和 `search_text` 达到结果上限时暂不返回截断标记；MCP 当前不支持 OAuth、旧版 SSE、Resources 和 Prompts。
- 符号链接测试在 Windows 上跳过；具体测试与评测状态以 `pnpm test` 和最新 `.miniharness/evals/*.json` 报告为准。
