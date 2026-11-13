# MiniHarness

基于 **TypeScript、Cordis 和 DeepSeek** 的插件化 Coding Agent 运行时。需要 Node.js 22.13+ 与 pnpm。

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

2026-11-13 使用 `deepseek-flash`，在 **9 道能力核心题 × 每组 3 次** 的相同夹具和验收规则下比较：

| 配置 | 通过 / 有效运行 | 完成率 | 成功任务平均工具调用 | 成功任务平均 API Token | 每完成一题摊销 API Token |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 16 / 27 | 59.3% | 11.3 | 24,995 | 26,657 |
| Full | 25 / 27 | 92.6% | 12.5 | 27,840 | 48,131 |

Full 完成率高 **33.3 个百分点**，同时 Token 和工具调用成本更高。题集包含恢复任务，Baseline 关闭恢复能力；长上下文压力题、MCP 与权限专项不计入此表。样本量有限，不能将差异单独归因于某个插件。逐题与逐次结果见 [评测快照](docs/benchmark-core-2026-11-13.md)。

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm eval                    # 确定性故障检查
pnpm eval:benchmark -- --candidate-core  # 真实模型：Baseline + Full，各 3 次
```
