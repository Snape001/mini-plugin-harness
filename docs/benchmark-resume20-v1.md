# Resume-20 v1 评测快照

**日期：** 2026-11-14
**模型：** `deepseek-flash`
**套件：** `resume-20-v1`
**最终合并报告：** [`evaluation/results/resume-20-v1/resume20-v1-final/`](../evaluation/results/resume-20-v1/resume20-v1-final/summary.md)

## 套件构成

`resume-20-v1` 包含 **20 道计分题 + 2 道 MCP 诊断题**：

- 15 道 legacy common 题（`unit-test-addition` 因四组均失败，标记为不计分）；
- 3 道候选能力题：`candidate-skills-boundary-audit`、`candidate-prompt-requirement-revision`、`candidate-recovery-partial-write`；
- 3 道插件门控题：`plugin-skills-release-audit`、`plugin-context-cross-task-seal`、`plugin-prompt-repair-contract`；
- 2 道 MCP 诊断题：`mcp-call`、`mcp-discovery`，仅由 Full 及其消融组运行，不计入共享完成率。

计分分母因此是 **20 道共享题**。正式比较四组：Baseline、Session + Context、Prompt、Full，各运行 1 次；插件门控题另做 3 次重复。

## 最终四组结果

数据来自 base `resume20-v1-exploratory` 与插件主矩阵 `plugin-main-matrix-v1` 的第 1 次重复合并；`candidate-prompt-requirement-revision` 的 Full 按“两次一对一错取通过”记录。报告共 86 runs，0 基础设施错误，Permission 5/5。

| 配置 | 通过 / 有效 | 完成率 | 成功题平均 Token | 每完成一题摊销 Token | API 调用 | 延迟 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 15 / 20 | 75.0% | 7,924 | 10,116 | 5.9 | 8,487 ms |
| Session + Context | 18 / 20 | 90.0% | 9,264 | 9,984 | 6.0 | 8,334 ms |
| Prompt | 16 / 20 | 80.0% | 8,153 | 9,553 | 5.7 | 8,737 ms |
| **Full** | **20 / 20** | **100.0%** | **10,897** | **10,897** | **7.6** | **10,460 ms** |

Full 比 Baseline 多完成 **5 题（+25.0 个百分点）**。成本不是免费的：

- 成功题 Token **+37.5%**，每完成一题摊销 Token **+7.7%**；
- API 调用 **+28.8%**，延迟 **+23.2%**。

预算约束下 Full 也更高：≤25k / ≤50k / ≤100k Token 的完成率分别为 **95% / 100% / 100%**，Baseline 三档均为 **75%**。含 MCP 时 Full 为 **22 / 22**，但 MCP 是工具可用性差异，单独报告，不能当作相同工具下的推理优势。

## 插件门控题（各 3 次）

这些题的设计目标是“移除插件就明确失败”，而不是让模型靠通用能力也能通过。

| 题目 | Baseline | 对应单插件组 | Full | Full − 该插件 |
| --- | ---: | ---: | ---: | ---: |
| `plugin-skills-release-audit` | 0/3 | Skills 3/3（8,226 Token） | 3/3（6,817 Token） | 0/3 |
| `plugin-context-cross-task-seal` | 0/3 | Session + Context 3/3（5,889 Token） | 3/3（11,280 Token） | 0/3 |
| `plugin-prompt-repair-contract` | 0/3 | Prompt 3/3（14,798 Token） | 3/3（18,752 Token） | 0/3 |

关键事实：

1. **Skills 题：Full 比 Skills-only 更便宜**（6,817 vs 8,226 Token），因为 Prompt v3 明确要求“避免重复读取、验证一次即停”；两者都通过，Baseline/无 Skills 失败。Skills 的收益是完成门控 + 成本控制。
2. **Context 题：Full 是 Session + Context 的约 1.9 倍 Token**（11,280 vs 5,889），但两者都通过；Baseline、Prompt、Full − Context 都失败。Context 是必要条件，不是低成本优化。
3. **Prompt 题：Full 比 Prompt-only 贵 26.7%**（18,752 vs 14,798），但两者都通过；Baseline、Session、Full − Prompt 都失败。Prompt 是完成门控，不是成本优化。
4. 在 36-run 插件主矩阵中，Context 的 Full 出现 1 次第 2 次重复失败（2/3；缺 `handoff.txt`），另外两次通过。3 次重复的插件专项结果为 3/3；这说明 Context 门控题仍有约 1/9 的 Full 运行波动，不能把 20/20 当作稳定上界。

## 结论与边界

- **观察结果**：合并口径下 Full 20/20（100%），Baseline 15/20（75%）；每道插件门控题的独立三次重复为“无插件 0/3，有插件 3/3”。
- **插件作用可解释**：Skills 使门控审计题通过；Context 是跨任务记忆的必要条件，但在短任务上成本更高；Prompt 是修复契约的必要条件，但也增加 Token。MCP 只证明工具接入与调用，不证明推理提升。
- **不是“全面领先”**：Full 的 Token、调用和延迟都高于 Baseline；当前证据支持“完成率换成本”，不支持“Full 更便宜”。
- **样本边界**：主表是每组 1 次重复的合并结果；插件门控题是 3 次重复，Full 为 8/9（Context 有 1 次失败）。`candidate-prompt-requirement-revision` 的 Full 使用 best-of-two（主运行通过、消融复跑失败），原始两次状态都保留在 JSON。
- `unit-test-addition` 仍为不计分地板题（四组 0/4），不应重新计入完成率，除非先校准验收。

## 复现

```bash
pnpm eval:benchmark --suite resume-20-v1 --repetitions 1
pnpm eval:benchmark --tasks plugin-skills-release-audit --groups baseline,skills,full,full-no-skills --repetitions 3
pnpm eval:benchmark --tasks plugin-context-cross-task-seal --groups baseline,session-context,full,full-no-context --repetitions 3
pnpm eval:benchmark --tasks plugin-prompt-repair-contract --groups baseline,prompt,full,full-no-prompt --repetitions 3
```

复现会生成新的随机模型运行；归档数据是本次实验的固定记录。解压归档中的 `results.json.gz` 后，可由基础运行与插件主矩阵重建合并报告，`pnpm merge:benchmark --help` 提供参数说明。

## 原始数据

以下报告归档于 [`evaluation/results/resume-20-v1/`](../evaluation/results/resume-20-v1/)。每个目录保留可读 `summary.md`、`permission.json`，以及 gzip 压缩的完整 `results.json` 和 `runs.csv`。本地 `.miniharness/evals/` 仅供运行时输出，不纳入 Git。

- 最终合并：`evaluation/results/resume-20-v1/resume20-v1-final/`
- 基础 20 题：`evaluation/results/resume-20-v1/resume20-v1-exploratory/`
- 插件主矩阵：`evaluation/results/resume-20-v1/plugin-main-matrix-v1/`
- Skills 3 次：`evaluation/results/resume-20-v1/plugin-skills-formal-v1/`
- Context 3 次：`evaluation/results/resume-20-v1/plugin-context-formal-v1/`
- Prompt 3 次：`evaluation/results/resume-20-v1/plugin-prompt-formal-v1/`
- Full-minus-one：`evaluation/results/resume-20-v1/resume20-v1-ablation/`
