# MiniHarness

基于 Cordis 的 TypeScript Agent 运行时，使用 DeepSeek 进行任务规划与工具调用。

## 主要功能

- 插件化 Agent、Skills、Hooks、工具与权限管理；支持可选的 MCP 工具服务。
- 文件工具限制在项目目录内；写入默认拒绝，Shell 命令每次都需要人工审批。
- SQLite 保存会话、工具调用和尝试记录；任务可暂停、中断并通过 `:resume` 继续。
- MCP 断线持续重连；提供不依赖真实模型的本地故障评测。

## 快速开始

需要 Node.js 22.13+、pnpm 和 DeepSeek API Key。

```bash
pnpm install
cp .env.example .env
# 在 .env 中填写 DEEPSEEK_API_KEY
pnpm dev
```

单次执行：`pnpm dev --task "分析这个项目"`。交互模式使用 `:session list` 查看会话、`:tasks` 查看任务、`:resume <task-id>` 续跑，输入 `exit` 退出。

在 [miniharness.yml](miniharness.yml) 中设置项目目录、迭代上限、插件和权限。`maxIterations` 是每段轮数，`maxTaskIterations` 是单任务总轮数（默认 100）。要允许写文件，可配置：

```yaml
permissions:
  allow: [write_file]
```

危险工具即使命中白名单仍需逐次审批；非交互运行无法审批时会拒绝执行。启用 MCP 时将 `mcp` 加入 `plugins`，并在 `mcp.servers` 中配置 `stdio` 或 Streamable HTTP 服务。

## 验证

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm eval
```

评测报告写入 `.miniharness/evals/`。文件操作会拒绝符号链接并校验打开的文件；纯 Node 实现仍存在并发替换目录的竞态。开发状态见 [开发进度](docs/development-log.md)。
