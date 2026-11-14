# MiniHarness 开发记录

**更新日期：** 2026-11-14

当前 Runtime 包含 Cordis Agent Loop、Skills、版本化 Prompt、Session/Context、文件与 Shell 工具、Permission、MCP 和可靠性治理。Session 使用 SQLite 保存消息与工具调用，支持显式恢复；Context 采用预算、工具结果裁剪与分层摘要。

最终评测套件为 `resume-20-v1`：20 道共享计分题、2 道 MCP 专项题，以及 Skills、Context、Prompt 各一题的独立三次重复和对应的 Full-minus-one 消融。真实模型结果、限制及原始记录见 [最终评测记录](benchmark-resume20-v1.md)。

本次清理保留最终合并报告、基础运行、补充插件矩阵、三项插件重复实验与消融运行，归档在 [`evaluation/results/resume-20-v1/`](../evaluation/results/resume-20-v1/)。旧校准、试跑及其输出已移除。确定性故障检查的 6 个场景全部通过；报告见 [`deterministic.json`](../evaluation/results/resume-20-v1/deterministic.json)。

验证命令：`pnpm exec tsc --noEmit`、`pnpm test`、`pnpm eval`。
