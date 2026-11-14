# MiniHarness

基于 **TypeScript、Cordis 和 DeepSeek** 的轻量化、插件化 Coding Agent Harness。需要 Node.js 22.13+ 与 pnpm。

## 架构

`CLI → Agent Loop → LLM / Tools`，由 Cordis 组合以下能力：

- **Skills / Prompt**：按任务选择 Skill、按需加载正文；版本化 Prompt 覆盖初始、工具后续和恢复阶段。
- **Session / Context**：`node:sqlite` 保存任务、消息和工具尝试；分层摘要与 Token 预算控制上下文，支持显式恢复中断任务。
- **Tools / Permission / MCP**：项目内文件读写、逐次审批的 Shell、MCP 工具发现与重连；只读工具失败可有限重试。
- **Evaluation**：隔离工作区、独立验收、真实模型消融实验，以及不调用模型的故障与权限测试。

## 快速开始

```bash
pnpm install
cp .env.example .env  # 填写 DEEPSEEK_API_KEY
pnpm dev
```

交互模式可用 `:session list`、`:tasks`、`:resume <task-id>`；单次任务用 `pnpm dev --task "分析这个项目"`。配置见 [miniharness.yml](miniharness.yml)。默认拒绝写入；允许 Agent 修改代码时设置 `permissions.allow: [write_file]`。Shell 始终需要人工审批。

## 评测结果

2026-11-14 使用 `deepseek-flash` 评测 `resume-20-v1`：20 道共享计分题，每组每题 1 次，MCP 专项另计。

| 配置 | 通过 | 完成率 | 成功题平均工具调用 | 成功题平均 API Token | 成功题平均耗时 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 15/20 | 75% | 6.3 | 7,924 | 8.5 s |
| Session + Context | 18/20 | 90% | 5.7 | 9,264 | 8.3 s |
| Prompt | 16/20 | 80% | 6.3 | 8,153 | 8.7 s |
| Full | 20/20 | 100% | 6.0 | 10,897 | 10.5 s |

Full 比 Baseline 多通过 5 题，成功题平均 Token 增加 37.5%，耗时增加 23.2%。三道针对性插件题的独立三次重复中，对应插件组均为 3/3，移除对应插件均为 0/3；MCP 两道专项题均通过，权限参考场景 5/5，确定性故障检查 6/6。

主表由两批单次运行合并，Full 的一道题采用两次取通过结果；这些数字是当前任务集的观察值，不能视为稳定完成率或各插件的独立因果效应。实验设计、失败记录和原始数据见 [最终评测记录](docs/benchmark-resume20-v1.md) 与 [归档报告](evaluation/results/resume-20-v1/resume20-v1-final/summary.md)。

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm eval
pnpm eval:benchmark --suite resume-20-v1 --repetitions 1
```
