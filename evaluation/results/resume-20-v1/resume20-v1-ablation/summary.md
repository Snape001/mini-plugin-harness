# MiniHarness Benchmark Results

Runs: 80; created at: 2026-11-14T03:23:28.559Z. Infrastructure errors are excluded from completion-rate denominators.

## Per-task results

| Task | Group | Passed / valid | Completion | Tools / success | Model rounds | API tokens | Latency ms | Skill accuracy | Prompt stages | Context preserved | Context compressed | MCP discovery | MCP recovery | Infra errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| boundary-condition-fix | full | 1/1 | 100.0% | 6.0 | 6.0 | 9811 | 9604 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| boundary-condition-fix | full-no-context | 1/1 | 100.0% | 9.0 | 8.0 | 13857 | 11972 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| boundary-condition-fix | full-no-prompt | 1/1 | 100.0% | 7.0 | 6.0 | 9834 | 9993 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| boundary-condition-fix | full-no-skills | 1/1 | 100.0% | 5.0 | 5.0 | 7411 | 9432 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| call-chain-trace | full | 1/1 | 100.0% | 5.0 | 4.0 | 5319 | 6484 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| call-chain-trace | full-no-context | 1/1 | 100.0% | 5.0 | 4.0 | 5406 | 7351 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| call-chain-trace | full-no-prompt | 1/1 | 100.0% | 9.0 | 7.0 | 10905 | 9551 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| call-chain-trace | full-no-skills | 1/1 | 100.0% | 5.0 | 3.0 | 3606 | 4980 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | full | 0/1 | 0.0% | n/a | 6.0 | 8620 | 8216 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | full-no-context | 0/1 | 0.0% | n/a | 5.0 | 7113 | 9035 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | full-no-prompt | 0/1 | 0.0% | n/a | 5.0 | 6633 | 6538 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | full-no-skills | 0/1 | 0.0% | n/a | 6.0 | 7881 | 7730 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | full | 1/1 | 100.0% | 5.0 | 5.0 | 6525 | 6408 | n/a | 0.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | full-no-context | 1/1 | 100.0% | 4.0 | 5.0 | 6122 | 6888 | n/a | 0.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | full-no-prompt | 1/1 | 100.0% | 6.0 | 7.0 | 8702 | 8300 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | full-no-skills | 1/1 | 100.0% | 4.0 | 5.0 | 5633 | 5490 | n/a | 0.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | full | 1/1 | 100.0% | 6.0 | 6.0 | 9599 | 10359 | 0.0% | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | full-no-context | 1/1 | 100.0% | 10.0 | 9.0 | 19489 | 16118 | 0.0% | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | full-no-prompt | 1/1 | 100.0% | 6.0 | 6.0 | 9937 | 9582 | 0.0% | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | full-no-skills | 1/1 | 100.0% | 33.0 | 23.0 | 88930 | 34794 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| code-review | full | 1/1 | 100.0% | 2.0 | 2.0 | 3496 | 8874 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| code-review | full-no-context | 1/1 | 100.0% | 2.0 | 2.0 | 3190 | 6888 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| code-review | full-no-prompt | 1/1 | 100.0% | 2.0 | 2.0 | 3117 | 6933 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| code-review | full-no-skills | 1/1 | 100.0% | 2.0 | 2.0 | 2776 | 7519 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| configuration-change | full | 1/1 | 100.0% | 5.0 | 5.0 | 6333 | 5023 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| configuration-change | full-no-context | 1/1 | 100.0% | 5.0 | 5.0 | 6368 | 6988 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| configuration-change | full-no-prompt | 1/1 | 100.0% | 6.0 | 5.0 | 6315 | 5571 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| configuration-change | full-no-skills | 1/1 | 100.0% | 5.0 | 5.0 | 5665 | 5699 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| context-window-recall | full | 1/1 | 100.0% | 6.0 | 12.0 | 42735 | 17583 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| context-window-recall | full-no-context | 1/1 | 100.0% | 9.0 | 14.0 | 21196 | 18025 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| context-window-recall | full-no-prompt | 1/1 | 100.0% | 6.0 | 12.0 | 41549 | 19677 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| context-window-recall | full-no-skills | 1/1 | 100.0% | 7.0 | 13.0 | 42820 | 14517 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| continuous-modification | full | 1/1 | 100.0% | 6.0 | 7.0 | 10188 | 8103 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| continuous-modification | full-no-context | 1/1 | 100.0% | 9.0 | 9.0 | 11109 | 10398 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| continuous-modification | full-no-prompt | 1/1 | 100.0% | 7.0 | 8.0 | 11274 | 9339 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| continuous-modification | full-no-skills | 1/1 | 100.0% | 6.0 | 7.0 | 9169 | 8138 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| cross-task-handoff | full | 1/1 | 100.0% | 3.0 | 5.0 | 5853 | 5934 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| cross-task-handoff | full-no-context | 1/1 | 100.0% | 5.0 | 6.0 | 7085 | 7749 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| cross-task-handoff | full-no-prompt | 1/1 | 100.0% | 2.0 | 4.0 | 4537 | 5864 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| cross-task-handoff | full-no-skills | 1/1 | 100.0% | 3.0 | 5.0 | 4890 | 4248 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| locate-constant | full | 1/1 | 100.0% | 3.0 | 3.0 | 3685 | 4278 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| locate-constant | full-no-context | 1/1 | 100.0% | 3.0 | 3.0 | 3680 | 4856 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| locate-constant | full-no-prompt | 1/1 | 100.0% | 3.0 | 3.0 | 3646 | 4759 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| locate-constant | full-no-skills | 1/1 | 100.0% | 3.0 | 3.0 | 3059 | 3879 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| mcp-call | full | 1/1 | 100.0% | 4.0 | 4.0 | 10677 | 5103 | n/a | 100.0% | n/a | n/a | 100.0% | n/a | 0 |
| mcp-call | full-no-context | 1/1 | 100.0% | 4.0 | 4.0 | 10664 | 5108 | n/a | 100.0% | n/a | n/a | 100.0% | n/a | 0 |
| mcp-call | full-no-prompt | 1/1 | 100.0% | 4.0 | 4.0 | 10600 | 5365 | n/a | n/a | n/a | n/a | 100.0% | n/a | 0 |
| mcp-call | full-no-skills | 1/1 | 100.0% | 4.0 | 4.0 | 10209 | 4226 | n/a | 100.0% | n/a | n/a | 100.0% | n/a | 0 |
| mcp-discovery | full | 1/1 | 100.0% | 4.0 | 4.0 | 10243 | 5159 | n/a | 100.0% | n/a | n/a | 100.0% | n/a | 0 |
| mcp-discovery | full-no-context | 1/1 | 100.0% | 4.0 | 4.0 | 10227 | 5132 | n/a | 100.0% | n/a | n/a | 100.0% | n/a | 0 |
| mcp-discovery | full-no-prompt | 1/1 | 100.0% | 4.0 | 4.0 | 10219 | 4573 | n/a | n/a | n/a | n/a | 100.0% | n/a | 0 |
| mcp-discovery | full-no-skills | 1/1 | 100.0% | 4.0 | 4.0 | 9887 | 4618 | n/a | 100.0% | n/a | n/a | 100.0% | n/a | 0 |
| module-dependencies | full | 1/1 | 100.0% | 5.0 | 3.0 | 4413 | 6450 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| module-dependencies | full-no-context | 1/1 | 100.0% | 5.0 | 3.0 | 4318 | 5689 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| module-dependencies | full-no-prompt | 1/1 | 100.0% | 5.0 | 3.0 | 4089 | 5404 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| module-dependencies | full-no-skills | 1/1 | 100.0% | 4.0 | 3.0 | 3656 | 4955 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| multi-file-port-fix | full | 1/1 | 100.0% | 9.0 | 6.0 | 9657 | 9599 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| multi-file-port-fix | full-no-context | 1/1 | 100.0% | 9.0 | 6.0 | 9856 | 8452 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| multi-file-port-fix | full-no-prompt | 1/1 | 100.0% | 11.0 | 9.0 | 17424 | 13310 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| multi-file-port-fix | full-no-skills | 1/1 | 100.0% | 9.0 | 6.0 | 9093 | 7884 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| new-function | full | 1/1 | 100.0% | 6.0 | 6.0 | 9100 | 10552 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| new-function | full-no-context | 1/1 | 100.0% | 7.0 | 5.0 | 7311 | 8719 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| new-function | full-no-prompt | 1/1 | 100.0% | 8.0 | 7.0 | 10775 | 10656 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| new-function | full-no-skills | 1/1 | 100.0% | 6.0 | 6.0 | 8436 | 8405 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| single-file-backoff-fix | full | 1/1 | 100.0% | 5.0 | 5.0 | 6995 | 8025 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| single-file-backoff-fix | full-no-context | 1/1 | 100.0% | 5.0 | 5.0 | 7540 | 9793 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| single-file-backoff-fix | full-no-prompt | 1/1 | 100.0% | 5.0 | 5.0 | 6976 | 7471 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| single-file-backoff-fix | full-no-skills | 1/1 | 100.0% | 5.0 | 5.0 | 6280 | 6242 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| test-failure-analysis | full | 1/1 | 100.0% | 6.0 | 5.0 | 8110 | 8943 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| test-failure-analysis | full-no-context | 1/1 | 100.0% | 6.0 | 5.0 | 8157 | 10098 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| test-failure-analysis | full-no-prompt | 1/1 | 100.0% | 8.0 | 5.0 | 8673 | 10408 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| test-failure-analysis | full-no-skills | 1/1 | 100.0% | 6.0 | 5.0 | 7595 | 9224 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| transient-tool-failure | full | 1/1 | 100.0% | 6.0 | 5.0 | 6326 | 5394 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| transient-tool-failure | full-no-context | 1/1 | 100.0% | 6.0 | 5.0 | 6310 | 5993 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| transient-tool-failure | full-no-prompt | 1/1 | 100.0% | 4.0 | 5.0 | 5498 | 5582 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| transient-tool-failure | full-no-skills | 1/1 | 100.0% | 5.0 | 5.0 | 5528 | 4651 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| unit-test-addition | full | 0/1 | 0.0% | n/a | 4.0 | 5690 | 5816 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| unit-test-addition | full-no-context | 0/1 | 0.0% | n/a | 4.0 | 5706 | 6260 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| unit-test-addition | full-no-prompt | 0/1 | 0.0% | n/a | 5.0 | 6847 | 5879 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| unit-test-addition | full-no-skills | 0/1 | 0.0% | n/a | 4.0 | 5137 | 5342 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |

## Shared suite totals

| Group | Passed / valid task runs | Completion | Tools / success | Agent rounds | API calls | Tokens / successful task | Amortized tokens / completion | Latency / success ms | Infra errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full | 16/18 | 88.9% | 5.3 | 5.3 | 6.8 | 9259 | 10153 | 8226 | 0 |
| full-no-context | 16/18 | 88.9% | 6.2 | 5.7 | 7.1 | 8812 | 9613 | 9124 | 0 |
| full-no-prompt | 16/18 | 88.9% | 5.9 | 5.8 | 7.3 | 10203 | 11046 | 8900 | 0 |
| full-no-skills | 16/18 | 88.9% | 6.8 | 6.2 | 6.3 | 13409 | 14223 | 8754 | 0 |

### Model request and token breakdown per valid run

| Group | Agent requests | Agent tokens | Skill selection requests | Skill selection tokens | Summary requests | Summary tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| full | 5.3 | 8215 | 1.4 | 663 | 0.1 | 148 |
| full-no-context | 5.7 | 7883 | 1.4 | 662 | 0.0 | 0 |
| full-no-prompt | 5.8 | 9008 | 1.4 | 663 | 0.1 | 148 |
| full-no-skills | 6.2 | 12498 | 0.0 | 0 | 0.1 | 144 |

## Group comparison (shared common tasks)

| Group | Completion | Δ completion | Tokens / success | Amortized tokens / completion | API calls / success | ≤25k completion | ≤50k completion | ≤100k completion | Δ latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full | 88.9% | n/a | 9259 | 10153 | 6.9 | 83.3% | 88.9% | 88.9% | n/a |
| full-no-context | 88.9% | n/a | 8812 | 9613 | 7.3 | 88.9% | 88.9% | 88.9% | n/a |
| full-no-prompt | 88.9% | n/a | 10203 | 11046 | 7.4 | 83.3% | 88.9% | 88.9% | n/a |
| full-no-skills | 88.9% | n/a | 13409 | 14223 | 6.4 | 77.8% | 83.3% | 88.9% | n/a |

Deltas are relative to the baseline group; negative token, latency, and API-call deltas are improvements. Completion deltas are percentage points.

### Full-minus-one attribution contrasts

| Contrast | Completion difference | Amortized token difference | API calls / successful task difference |
| --- | ---: | ---: | ---: |
| Full − full-no-skills | 0.0 pp | -4069 | 0.4 |
| Full − full-no-prompt | 0.0 pp | -892 | -0.6 |
| Full − full-no-context | 0.0 pp | 540 | -0.4 |

## Individual runs

| Task | Group | Repeat | Status | Failure kind | Agent / Skill / Summary requests | Cap reason | Tools | API tokens | Latency ms | Acceptance detail |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| locate-constant | full | 1 | passed | — | 3 / 1 / 0 | — | 3 | 3685 | 4278 | Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms. |
| locate-constant | full-no-skills | 1 | passed | — | 3 / 0 / 0 | — | 3 | 3059 | 3879 | Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms. |
| locate-constant | full-no-prompt | 1 | passed | — | 3 / 1 / 0 | — | 3 | 3646 | 4759 | Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms. |
| locate-constant | full-no-context | 1 | passed | — | 3 / 1 / 0 | — | 3 | 3680 | 4856 | Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms. |
| single-file-backoff-fix | full | 1 | passed | — | 5 / 1 / 0 | — | 5 | 6995 | 8025 | backoffMs passed the three executable cases. |
| single-file-backoff-fix | full-no-skills | 1 | passed | — | 5 / 0 / 0 | — | 5 | 6280 | 6242 | backoffMs passed the three executable cases. |
| single-file-backoff-fix | full-no-prompt | 1 | passed | — | 5 / 1 / 0 | — | 5 | 6976 | 7471 | backoffMs passed the three executable cases. |
| single-file-backoff-fix | full-no-context | 1 | passed | — | 5 / 1 / 0 | — | 5 | 7540 | 9793 | backoffMs passed the three executable cases. |
| multi-file-port-fix | full | 1 | passed | — | 6 / 1 / 0 | — | 9 | 9657 | 9599 | Default and explicit port cases passed. |
| multi-file-port-fix | full-no-skills | 1 | passed | — | 6 / 0 / 0 | — | 9 | 9093 | 7884 | Default and explicit port cases passed. |
| multi-file-port-fix | full-no-prompt | 1 | passed | — | 9 / 1 / 0 | — | 11 | 17424 | 13310 | Default and explicit port cases passed. |
| multi-file-port-fix | full-no-context | 1 | passed | — | 6 / 1 / 0 | — | 9 | 9856 | 8452 | Default and explicit port cases passed. |
| cross-task-handoff | full | 1 | passed | — | 5 / 2 / 0 | — | 3 | 5853 | 5934 | The first task must locate the handoff code. handoff.txt must contain the code carried over from the prior task. |
| cross-task-handoff | full-no-skills | 1 | passed | — | 5 / 0 / 0 | — | 3 | 4890 | 4248 | The first task must locate the handoff code. handoff.txt must contain the code carried over from the prior task. |
| cross-task-handoff | full-no-prompt | 1 | passed | — | 4 / 2 / 0 | — | 2 | 4537 | 5864 | The first task must locate the handoff code. handoff.txt must contain the code carried over from the prior task. |
| cross-task-handoff | full-no-context | 1 | passed | — | 6 / 2 / 0 | — | 5 | 7085 | 7749 | The first task must locate the handoff code. handoff.txt must contain the code carried over from the prior task. |
| context-window-recall | full | 1 | passed | — | 12 / 6 / 2 | — | 6 | 42735 | 17583 | Task 1 must return PAGE-1-JUNIPER-162. Task 2 must return PAGE-2-JUNIPER-262. Task 3 must return PAGE-3-JUNIPER-362. Task 4 must return PAGE-4-JUNIPER-462. Task |
| context-window-recall | full-no-skills | 1 | passed | — | 13 / 0 / 2 | — | 7 | 42820 | 14517 | Task 1 must return PAGE-1-JUNIPER-162. Task 2 must return PAGE-2-JUNIPER-262. Task 3 must return PAGE-3-JUNIPER-362. Task 4 must return PAGE-4-JUNIPER-462. Task |
| context-window-recall | full-no-prompt | 1 | passed | — | 12 / 6 / 2 | — | 6 | 41549 | 19677 | Task 1 must return PAGE-1-JUNIPER-162. Task 2 must return PAGE-2-JUNIPER-262. Task 3 must return PAGE-3-JUNIPER-362. Task 4 must return PAGE-4-JUNIPER-462. Task |
| context-window-recall | full-no-context | 1 | passed | — | 14 / 6 / 0 | — | 9 | 21196 | 18025 | Task 1 must return PAGE-1-JUNIPER-162. Task 2 must return PAGE-2-JUNIPER-262. Task 3 must return PAGE-3-JUNIPER-362. Task 4 must return PAGE-4-JUNIPER-462. Task |
| transient-tool-failure | full | 1 | passed | — | 5 / 1 / 0 | — | 6 | 6326 | 5394 | The tool failure should be handled and MAPLE-208 written to lookup-result.txt. |
| transient-tool-failure | full-no-skills | 1 | passed | — | 5 / 0 / 0 | — | 5 | 5528 | 4651 | The tool failure should be handled and MAPLE-208 written to lookup-result.txt. |
| transient-tool-failure | full-no-prompt | 1 | passed | — | 5 / 1 / 0 | — | 4 | 5498 | 5582 | The tool failure should be handled and MAPLE-208 written to lookup-result.txt. |
| transient-tool-failure | full-no-context | 1 | passed | — | 5 / 1 / 0 | — | 6 | 6310 | 5993 | The tool failure should be handled and MAPLE-208 written to lookup-result.txt. |
| module-dependencies | full | 1 | passed | — | 3 / 1 / 0 | — | 5 | 4413 | 6450 | Must identify the ordered imports and both symbols. |
| module-dependencies | full-no-skills | 1 | passed | — | 3 / 0 / 0 | — | 4 | 3656 | 4955 | Must identify the ordered imports and both symbols. |
| module-dependencies | full-no-prompt | 1 | passed | — | 3 / 1 / 0 | — | 5 | 4089 | 5404 | Must identify the ordered imports and both symbols. |
| module-dependencies | full-no-context | 1 | passed | — | 3 / 1 / 0 | — | 5 | 4318 | 5689 | Must identify the ordered imports and both symbols. |
| call-chain-trace | full | 1 | passed | — | 4 / 1 / 0 | — | 5 | 5319 | 6484 | Must trace handle → dispatch → persist and saved:A7. |
| call-chain-trace | full-no-skills | 1 | passed | — | 3 / 0 / 0 | — | 5 | 3606 | 4980 | Must trace handle → dispatch → persist and saved:A7. |
| call-chain-trace | full-no-prompt | 1 | passed | — | 7 / 1 / 0 | — | 9 | 10905 | 9551 | Must trace handle → dispatch → persist and saved:A7. |
| call-chain-trace | full-no-context | 1 | passed | — | 4 / 1 / 0 | — | 5 | 5406 | 7351 | Must trace handle → dispatch → persist and saved:A7. |
| boundary-condition-fix | full | 1 | passed | — | 6 / 1 / 0 | — | 6 | 9811 | 9604 | Boundary cases: negative, empty, above-range, and valid index. |
| boundary-condition-fix | full-no-skills | 1 | passed | — | 5 / 0 / 0 | — | 5 | 7411 | 9432 | Boundary cases: negative, empty, above-range, and valid index. |
| boundary-condition-fix | full-no-prompt | 1 | passed | — | 6 / 1 / 0 | — | 7 | 9834 | 9993 | Boundary cases: negative, empty, above-range, and valid index. |
| boundary-condition-fix | full-no-context | 1 | passed | — | 8 / 1 / 0 | — | 9 | 13857 | 11972 | Boundary cases: negative, empty, above-range, and valid index. |
| new-function | full | 1 | passed | — | 6 / 1 / 0 | — | 6 | 9100 | 10552 | slugify must satisfy four executable cases. |
| new-function | full-no-skills | 1 | passed | — | 6 / 0 / 0 | — | 6 | 8436 | 8405 | slugify must satisfy four executable cases. |
| new-function | full-no-prompt | 1 | passed | — | 7 / 1 / 0 | — | 8 | 10775 | 10656 | slugify must satisfy four executable cases. |
| new-function | full-no-context | 1 | passed | — | 5 / 1 / 0 | — | 7 | 7311 | 8719 | slugify must satisfy four executable cases. |
| configuration-change | full | 1 | passed | — | 5 / 1 / 0 | — | 5 | 6333 | 5023 | Config and executable client must both use retryLimit=4. |
| configuration-change | full-no-skills | 1 | passed | — | 5 / 0 / 0 | — | 5 | 5665 | 5699 | Config and executable client must both use retryLimit=4. |
| configuration-change | full-no-prompt | 1 | passed | — | 5 / 1 / 0 | — | 6 | 6315 | 5571 | Config and executable client must both use retryLimit=4. |
| configuration-change | full-no-context | 1 | passed | — | 5 / 1 / 0 | — | 5 | 6368 | 6988 | Config and executable client must both use retryLimit=4. |
| unit-test-addition | full | 1 | failed | acceptance | 4 / 1 / 0 | — | 4 | 5690 | 5816 | Tests must cover four cases without altering implementation. |
| unit-test-addition | full-no-skills | 1 | failed | acceptance | 4 / 0 / 0 | — | 4 | 5137 | 5342 | Tests must cover four cases without altering implementation. |
| unit-test-addition | full-no-prompt | 1 | failed | acceptance | 5 / 1 / 0 | — | 5 | 6847 | 5879 | Tests must cover four cases without altering implementation. |
| unit-test-addition | full-no-context | 1 | failed | acceptance | 4 / 1 / 0 | — | 4 | 5706 | 6260 | Tests must cover four cases without altering implementation. |
| code-review | full | 1 | passed | — | 2 / 1 / 0 | — | 2 | 3496 | 8874 | Review must identify token logging and loose equality, with fixes; source must stay unchanged. |
| code-review | full-no-skills | 1 | passed | — | 2 / 0 / 0 | — | 2 | 2776 | 7519 | Review must identify token logging and loose equality, with fixes; source must stay unchanged. |
| code-review | full-no-prompt | 1 | passed | — | 2 / 1 / 0 | — | 2 | 3117 | 6933 | Review must identify token logging and loose equality, with fixes; source must stay unchanged. |
| code-review | full-no-context | 1 | passed | — | 2 / 1 / 0 | — | 2 | 3190 | 6888 | Review must identify token logging and loose equality, with fixes; source must stay unchanged. |
| test-failure-analysis | full | 1 | passed | — | 5 / 1 / 0 | — | 6 | 8110 | 8943 | Must diagnose percent-versus-fraction mismatch without changing code. |
| test-failure-analysis | full-no-skills | 1 | passed | — | 5 / 0 / 0 | — | 6 | 7595 | 9224 | Must diagnose percent-versus-fraction mismatch without changing code. |
| test-failure-analysis | full-no-prompt | 1 | passed | — | 5 / 1 / 0 | — | 8 | 8673 | 10408 | Must diagnose percent-versus-fraction mismatch without changing code. |
| test-failure-analysis | full-no-context | 1 | passed | — | 5 / 1 / 0 | — | 6 | 8157 | 10098 | Must diagnose percent-versus-fraction mismatch without changing code. |
| continuous-modification | full | 1 | passed | — | 7 / 2 / 0 | — | 6 | 10188 | 8103 | First change must update only capacity. Both sequential changes must remain valid. |
| continuous-modification | full-no-skills | 1 | passed | — | 7 / 0 / 0 | — | 6 | 9169 | 8138 | First change must update only capacity. Both sequential changes must remain valid. |
| continuous-modification | full-no-prompt | 1 | passed | — | 8 / 2 / 0 | — | 7 | 11274 | 9339 | First change must update only capacity. Both sequential changes must remain valid. |
| continuous-modification | full-no-context | 1 | passed | — | 9 / 2 / 0 | — | 9 | 11109 | 10398 | First change must update only capacity. Both sequential changes must remain valid. |
| candidate-skills-boundary-audit | full | 1 | passed | — | 6 / 1 / 0 | — | 6 | 9599 | 10359 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | full-no-skills | 1 | passed | — | 23 / 0 / 0 | — | 33 | 88930 | 34794 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | full-no-prompt | 1 | passed | — | 6 / 1 / 0 | — | 6 | 9937 | 9582 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | full-no-context | 1 | passed | — | 9 / 1 / 0 | — | 10 | 19489 | 16118 | All four independent boundary cases must pass. |
| candidate-prompt-requirement-revision | full | 1 | failed | acceptance | 6 / 1 / 0 | — | 6 | 8620 | 8216 | Initial retry behavior must pass. |
| candidate-prompt-requirement-revision | full-no-skills | 1 | failed | acceptance | 6 / 0 / 0 | — | 6 | 7881 | 7730 | Initial retry behavior must pass. |
| candidate-prompt-requirement-revision | full-no-prompt | 1 | failed | acceptance | 5 / 1 / 0 | — | 5 | 6633 | 6538 | Initial retry behavior must pass. |
| candidate-prompt-requirement-revision | full-no-context | 1 | failed | acceptance | 5 / 1 / 0 | — | 6 | 7113 | 9035 | Initial retry behavior must pass. |
| candidate-recovery-partial-write | full | 1 | passed | — | 5 / 1 / 0 | — | 5 | 6525 | 6408 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-partial-write | full-no-skills | 1 | passed | — | 5 / 0 / 0 | — | 4 | 5633 | 5490 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-partial-write | full-no-prompt | 1 | passed | — | 7 / 1 / 0 | — | 6 | 8702 | 8300 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-partial-write | full-no-context | 1 | passed | — | 5 / 1 / 0 | — | 4 | 6122 | 6888 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| mcp-call | full | 1 | passed | — | 4 / 1 / 0 | — | 4 | 10677 | 5103 | Must call discovered MCP echo tool and persist its exact result. |
| mcp-call | full-no-skills | 1 | passed | — | 4 / 0 / 0 | — | 4 | 10209 | 4226 | Must call discovered MCP echo tool and persist its exact result. |
| mcp-call | full-no-prompt | 1 | passed | — | 4 / 1 / 0 | — | 4 | 10600 | 5365 | Must call discovered MCP echo tool and persist its exact result. |
| mcp-call | full-no-context | 1 | passed | — | 4 / 1 / 0 | — | 4 | 10664 | 5108 | Must call discovered MCP echo tool and persist its exact result. |
| mcp-discovery | full | 1 | passed | — | 4 / 1 / 0 | — | 4 | 10243 | 5159 | The discovered MCP tool must return MCP-CEDAR-931 and the value must be written to mcp-result.txt. |
| mcp-discovery | full-no-skills | 1 | passed | — | 4 / 0 / 0 | — | 4 | 9887 | 4618 | The discovered MCP tool must return MCP-CEDAR-931 and the value must be written to mcp-result.txt. |
| mcp-discovery | full-no-prompt | 1 | passed | — | 4 / 1 / 0 | — | 4 | 10219 | 4573 | The discovered MCP tool must return MCP-CEDAR-931 and the value must be written to mcp-result.txt. |
| mcp-discovery | full-no-context | 1 | passed | — | 4 / 1 / 0 | — | 4 | 10227 | 5132 | The discovered MCP tool must return MCP-CEDAR-931 and the value must be written to mcp-result.txt. |

## Specialized scenarios

| Scenario | Groups | Passed / valid | Completion | Infra errors |
| --- | --- | ---: | ---: | ---: |
| mcp-call | full, full-no-context, full-no-prompt, full-no-skills | 4/4 | 100.0% | 0 |
| mcp-discovery | full, full-no-context, full-no-prompt, full-no-skills | 4/4 | 100.0% | 0 |

Token averages and budget completion use only runs with complete API usage. Infrastructure errors are excluded from completion rates. Specialized scenarios are reported separately. Per-run cap reasons are recorded in JSON and CSV.

## Permission scenarios

- Status: passed
- Unauthorized operation block rate: 100.0%
- Cases matched reference policy: 5/5
- False allows: 0
- False denials: 0
