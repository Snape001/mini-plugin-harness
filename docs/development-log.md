# MiniHarness 开发进度

**更新日期：** 2026-11-13
**状态：** 核心运行时、权限治理、MCP、Session 恢复、可靠性加固及 Benchmark 校准/归因框架已实现；单次 Baseline/Full 真实模型校准完成。

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
- `pnpm eval:benchmark` 运行固定 coding 任务夹具的真实模型消融评测，输出逐次 JSON、Markdown 汇总、CSV 和独立权限场景结果；每次运行使用临时工作区并在 Agent 根目录外评分。
- Benchmark 支持八组配置：Baseline、Skills、Session + Context、Prompt、Full，以及 `full-no-skills`、`full-no-prompt`、`full-no-context`。共用题保留 15 道旧题并增加 Skills、Prompt、Context、Recovery 各 3 道候选题；另有 MCP 与 Permission 专项。共用题各组使用相同夹具、工具、权限和执行限制。
- Benchmark 每题最多 60 个 Agent 请求轮次、250,000 个实际 Token 和 15 分钟；只有 API 用量缺失时才启用 120 次请求兜底。Skill 选择与摘要请求另行计数和计费。Context 题的 `taskSet.contextInputTokens` 记录硬输入上限，输出预留另列；摘要重试会把更短预算传给模型 API。报告逐次记录验收、错误类型、Token 分类、Skill / Prompt 轨迹、Context 检查点和工具审批。
- Benchmark 的 Prompt / Full 组现在实际加载通用版本化文件，固定选择 `task/benchmark-initial@2`，并记录后续工具轮和恢复轮的模板 ID 与摘要。Context 压缩专项使用独立的小预算来触发四层机制；逐轮记录真实 Agent 请求中的 L1/L2/L3、最近任务、工具调用关联和预算，并单独计算三层摘要全部出现的比例。长上下文 fixture 的路径已与题目读取路径对齐。
- Skills 现有三项已明确阅读、审查、诊断边界，并增加 `targeted-code-fix`、`multi-file-consistency`。选择异常降级为空；单项和组合 Token 预算限制正文，仅首次请求注入。SQLite 与 Benchmark JSON 记录逐任务选择、加载、失败原因、耗时和用量。Benchmark Skills 位于 Agent 项目根目录外。

## 验收

- `pnpm exec tsc --noEmit`：通过。
- `pnpm exec vitest run --reporter=dot`：108 通过、4 跳过；Windows 下跳过平台相关用例。
- `pnpm eval`：6 个确定性故障场景通过；报告写入 `.miniharness/evals/2026-11-13T12-17-08-935Z.json`。
- 无外部模型的 Benchmark 正式入口：`mcp-recovery` 通过，Permission 5/5，报告版本 4 的 JSON、Markdown、CSV 已生成于 `.miniharness/evals/benchmark/plugin-integration-smoke/`。
- MCP 专项的断线重连测试实际启动 stdio 服务并验证工具移除、重发现和调用。
- 一次真实模型候选校准完成。最终合并口径为 Baseline **5/12（41.7%）**、Full **8/12（66.7%）**，Full 高 25 个百分点；这是单次结果，不代表统计显著，也不能单独归因到某个插件。Full 共用题约 **1,257,516 Token**，Baseline **157,827 Token**；每成功题平均约 **30,258 vs 9,728 Token**，所有题 Token 总和除以成功题数约 **157,190 vs 31,565 Token**。Full 三道 Context 候选题和一道 Skills 边界题达到 250k Token 安全上限；Context 轨迹实际出现 L1/L2/L3，但最终任务未完成。
- 校准数据目录：非 Context 候选行来自 `.miniharness/evals/benchmark/2026-11-13T11-16-08-377Z/`（Baseline）和 `2026-11-13T11-28-40-605Z/`（Full）；三道 Context 行使用修正预算后的 `.miniharness/evals/benchmark/2026-11-13T12-10-24-176Z/`。后者将 Context 题设为 4096 Token 硬输入上限、2048 Token 输出预留。候选任务与验收未更换。
- 单次校准显示 Full 在 Prompt 需求变更和 Recovery 上取得新增通过，但成本显著增加，Context 摘要请求是主要开销；该次结果不能用于声称单插件因果贡献。
- 后续能力核心题完成 Baseline / Full 各 27 次正式运行：Baseline 16/27（59.3%），Full 25/27（92.6%）；成功任务平均 API Token 分别为 24,995 和 27,840。9 道题涵盖 Skills、Prompt 和 Recovery 候选，Context 压力题另报；逐次结果见 [评测快照](benchmark-core-2026-11-13.md)。Full-minus-one 归因组尚未完成正式三次重复。

## 后续注意

- 文件操作检查与使用之间仍存在并发替换目录的 TOCTOU 窗口；纯 Node 缺少跨平台目录句柄能力，当前通过拒绝符号链接、`O_NOFOLLOW`（平台支持时）和打开后校验缩小风险。
- `list_files` 和 `search_text` 达到结果上限时暂不返回截断标记；MCP 当前不支持 OAuth、旧版 SSE、Resources 和 Prompts。
- 符号链接测试在 Windows 上跳过；具体测试与评测状态以 `pnpm exec vitest run`、`pnpm eval` 和 `.miniharness/evals/` 下的 JSON 报告为准。
