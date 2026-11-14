# MiniHarness Benchmark Results

Runs: 74; created at: 2026-11-14T03:11:59.247Z. Infrastructure errors are excluded from completion-rate denominators.

## Per-task results

| Task | Group | Passed / valid | Completion | Tools / success | Model rounds | API tokens | Latency ms | Skill accuracy | Prompt stages | Context preserved | Context compressed | MCP discovery | MCP recovery | Infra errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| boundary-condition-fix | baseline | 1/1 | 100.0% | 7.0 | 6.0 | 9097 | 8728 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| boundary-condition-fix | full | 1/1 | 100.0% | 9.0 | 9.0 | 16116 | 14214 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| boundary-condition-fix | prompt | 1/1 | 100.0% | 7.0 | 7.0 | 10270 | 10526 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| boundary-condition-fix | session-context | 1/1 | 100.0% | 7.0 | 6.0 | 9113 | 10147 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| call-chain-trace | baseline | 1/1 | 100.0% | 5.0 | 3.0 | 3636 | 4532 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| call-chain-trace | full | 1/1 | 100.0% | 5.0 | 4.0 | 5326 | 8501 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| call-chain-trace | prompt | 1/1 | 100.0% | 6.0 | 4.0 | 5090 | 7247 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| call-chain-trace | session-context | 1/1 | 100.0% | 5.0 | 3.0 | 3556 | 4647 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | baseline | 1/1 | 100.0% | 12.0 | 11.0 | 14777 | 17196 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | full | 1/1 | 100.0% | 10.0 | 11.0 | 22235 | 17148 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | prompt | 0/1 | 0.0% | n/a | 5.0 | 6512 | 7843 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | session-context | 1/1 | 100.0% | 9.0 | 8.0 | 14293 | 13084 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | baseline | 0/1 | 0.0% | n/a | 2.0 | 1973 | 2160 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | full | 1/1 | 100.0% | 5.0 | 5.0 | 6604 | 6928 | n/a | 0.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | prompt | 0/1 | 0.0% | n/a | 1.0 | 896 | 843 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | session-context | 1/1 | 100.0% | 6.0 | 7.0 | 8089 | 6889 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | baseline | 0/1 | 0.0% | n/a | 7.0 | 10563 | 9119 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | full | 1/1 | 100.0% | 6.0 | 6.0 | 9830 | 10824 | 0.0% | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | prompt | 1/1 | 100.0% | 6.0 | 5.0 | 8025 | 8954 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | session-context | 1/1 | 100.0% | 7.0 | 7.0 | 11257 | 9657 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| code-review | baseline | 1/1 | 100.0% | 3.0 | 3.0 | 4080 | 10417 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| code-review | full | 1/1 | 100.0% | 2.0 | 2.0 | 3527 | 10045 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| code-review | prompt | 1/1 | 100.0% | 2.0 | 2.0 | 2711 | 6675 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| code-review | session-context | 1/1 | 100.0% | 3.0 | 3.0 | 3869 | 8246 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| configuration-change | baseline | 1/1 | 100.0% | 5.0 | 5.0 | 5541 | 5436 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| configuration-change | full | 1/1 | 100.0% | 5.0 | 5.0 | 6355 | 5564 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| configuration-change | prompt | 1/1 | 100.0% | 6.0 | 5.0 | 5970 | 6584 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| configuration-change | session-context | 1/1 | 100.0% | 5.0 | 5.0 | 5497 | 5799 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| context-window-recall | baseline | 1/1 | 100.0% | 8.0 | 13.0 | 16576 | 13802 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| context-window-recall | full | 1/1 | 100.0% | 6.0 | 12.0 | 42315 | 20980 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| context-window-recall | prompt | 1/1 | 100.0% | 9.0 | 14.0 | 18441 | 15644 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| context-window-recall | session-context | 1/1 | 100.0% | 6.0 | 12.0 | 39125 | 15152 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| continuous-modification | baseline | 1/1 | 100.0% | 9.0 | 9.0 | 9875 | 9559 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| continuous-modification | full | 1/1 | 100.0% | 6.0 | 7.0 | 10027 | 10373 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| continuous-modification | prompt | 1/1 | 100.0% | 9.0 | 9.0 | 9954 | 11017 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| continuous-modification | session-context | 1/1 | 100.0% | 7.0 | 8.0 | 10085 | 7324 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| cross-task-handoff | baseline | 1/1 | 100.0% | 5.0 | 6.0 | 6003 | 7024 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| cross-task-handoff | full | 1/1 | 100.0% | 3.0 | 5.0 | 5820 | 7280 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| cross-task-handoff | prompt | 1/1 | 100.0% | 5.0 | 6.0 | 6216 | 7305 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| cross-task-handoff | session-context | 1/1 | 100.0% | 2.0 | 4.0 | 3601 | 3887 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| locate-constant | baseline | 1/1 | 100.0% | 3.0 | 3.0 | 2922 | 3844 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| locate-constant | full | 1/1 | 100.0% | 3.0 | 3.0 | 3714 | 5295 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| locate-constant | prompt | 1/1 | 100.0% | 3.0 | 3.0 | 3027 | 4317 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| locate-constant | session-context | 1/1 | 100.0% | 3.0 | 3.0 | 2997 | 4560 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| mcp-call | full | 1/1 | 100.0% | 4.0 | 4.0 | 10675 | 4480 | n/a | 100.0% | n/a | n/a | 100.0% | n/a | 0 |
| mcp-discovery | full | 1/1 | 100.0% | 4.0 | 4.0 | 10336 | 6412 | n/a | 100.0% | n/a | n/a | 100.0% | n/a | 0 |
| module-dependencies | baseline | 1/1 | 100.0% | 4.0 | 3.0 | 3428 | 4954 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| module-dependencies | full | 1/1 | 100.0% | 5.0 | 3.0 | 4364 | 7151 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| module-dependencies | prompt | 1/1 | 100.0% | 4.0 | 3.0 | 3628 | 5230 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| module-dependencies | session-context | 1/1 | 100.0% | 4.0 | 3.0 | 3656 | 6203 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| multi-file-port-fix | baseline | 1/1 | 100.0% | 8.0 | 6.0 | 8188 | 8481 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| multi-file-port-fix | full | 1/1 | 100.0% | 9.0 | 6.0 | 9714 | 11851 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| multi-file-port-fix | prompt | 1/1 | 100.0% | 9.0 | 6.0 | 9117 | 9914 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| multi-file-port-fix | session-context | 1/1 | 100.0% | 9.0 | 7.0 | 9764 | 9463 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| new-function | baseline | 1/1 | 100.0% | 9.0 | 8.0 | 12298 | 10706 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| new-function | full | 1/1 | 100.0% | 7.0 | 7.0 | 11540 | 12443 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| new-function | prompt | 1/1 | 100.0% | 8.0 | 8.0 | 13103 | 13129 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| new-function | session-context | 1/1 | 100.0% | 9.0 | 8.0 | 12454 | 12911 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| single-file-backoff-fix | baseline | 1/1 | 100.0% | 7.0 | 7.0 | 10003 | 9804 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| single-file-backoff-fix | full | 1/1 | 100.0% | 5.0 | 5.0 | 7367 | 10144 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| single-file-backoff-fix | prompt | 1/1 | 100.0% | 4.0 | 4.0 | 4976 | 6597 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| single-file-backoff-fix | session-context | 1/1 | 100.0% | 8.0 | 8.0 | 12085 | 11455 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| test-failure-analysis | baseline | 1/1 | 100.0% | 6.0 | 5.0 | 7405 | 8248 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| test-failure-analysis | full | 1/1 | 100.0% | 6.0 | 5.0 | 8380 | 10458 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| test-failure-analysis | prompt | 1/1 | 100.0% | 6.0 | 5.0 | 7751 | 10106 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| test-failure-analysis | session-context | 1/1 | 100.0% | 5.0 | 5.0 | 6610 | 9713 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| transient-tool-failure | baseline | 1/1 | 100.0% | 4.0 | 5.0 | 5025 | 4581 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| transient-tool-failure | full | 1/1 | 100.0% | 6.0 | 5.0 | 6289 | 5624 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| transient-tool-failure | prompt | 1/1 | 100.0% | 6.0 | 5.0 | 5855 | 5642 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| transient-tool-failure | session-context | 1/1 | 100.0% | 4.0 | 5.0 | 5025 | 5491 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| unit-test-addition | baseline | 0/1 | 0.0% | n/a | 5.0 | 6887 | 7046 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| unit-test-addition | full | 0/1 | 0.0% | n/a | 4.0 | 5804 | 6099 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| unit-test-addition | prompt | 0/1 | 0.0% | n/a | 4.0 | 5187 | 5265 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| unit-test-addition | session-context | 0/1 | 0.0% | n/a | 5.0 | 6853 | 5824 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |

## Shared suite totals

| Group | Passed / valid task runs | Completion | Tools / success | Agent rounds | API calls | Tokens / successful task | Amortized tokens / completion | Latency / success ms | Infra errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 15/18 | 83.3% | 6.3 | 5.9 | 5.9 | 7924 | 9218 | 8487 | 0 |
| full | 17/18 | 94.4% | 5.8 | 5.8 | 7.3 | 10560 | 10902 | 10284 | 0 |
| prompt | 15/18 | 83.3% | 6.0 | 5.3 | 5.3 | 7609 | 8449 | 8592 | 0 |
| session-context | 17/18 | 94.4% | 5.8 | 5.9 | 6.1 | 9475 | 9878 | 8508 | 0 |

### Model request and token breakdown per valid run

| Group | Agent requests | Agent tokens | Skill selection requests | Skill selection tokens | Summary requests | Summary tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 5.9 | 7682 | 0.0 | 0 | 0.0 | 0 |
| full | 5.8 | 9461 | 1.4 | 690 | 0.1 | 145 |
| prompt | 5.3 | 7041 | 0.0 | 0 | 0.0 | 0 |
| session-context | 5.9 | 9180 | 0.0 | 0 | 0.1 | 150 |

## Group comparison (shared common tasks)

| Group | Completion | Δ completion | Tokens / success | Amortized tokens / completion | API calls / success | ≤25k completion | ≤50k completion | ≤100k completion | Δ latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 83.3% | +0.0 pp | 7924 | 9218 | 6.2 | 83.3% | 83.3% | 83.3% | +0.0% |
| full | 94.4% | +11.1 pp | 10560 | 10902 | 7.5 | 88.9% | 94.4% | 94.4% | +21.2% |
| prompt | 83.3% | +0.0 pp | 7609 | 8449 | 5.7 | 83.3% | 83.3% | 83.3% | +1.2% |
| session-context | 94.4% | +11.1 pp | 9475 | 9878 | 6.1 | 88.9% | 94.4% | 94.4% | +0.2% |

Deltas are relative to the baseline group; negative token, latency, and API-call deltas are improvements. Completion deltas are percentage points.

### Full-minus-one attribution contrasts

| Contrast | Completion difference | Amortized token difference | API calls / successful task difference |
| --- | ---: | ---: | ---: |
| Full − baseline | 11.1 pp | 1683 | 1.3 |

## Individual runs

| Task | Group | Repeat | Status | Failure kind | Agent / Skill / Summary requests | Cap reason | Tools | API tokens | Latency ms | Acceptance detail |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| locate-constant | baseline | 1 | passed | — | 3 / 0 / 0 | — | 3 | 2922 | 3844 | Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms. |
| locate-constant | session-context | 1 | passed | — | 3 / 0 / 0 | — | 3 | 2997 | 4560 | Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms. |
| locate-constant | prompt | 1 | passed | — | 3 / 0 / 0 | — | 3 | 3027 | 4317 | Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms. |
| locate-constant | full | 1 | passed | — | 3 / 1 / 0 | — | 3 | 3714 | 5295 | Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms. |
| single-file-backoff-fix | baseline | 1 | passed | — | 7 / 0 / 0 | — | 7 | 10003 | 9804 | backoffMs passed the three executable cases. |
| single-file-backoff-fix | session-context | 1 | passed | — | 8 / 0 / 0 | — | 8 | 12085 | 11455 | backoffMs passed the three executable cases. |
| single-file-backoff-fix | prompt | 1 | passed | — | 4 / 0 / 0 | — | 4 | 4976 | 6597 | backoffMs passed the three executable cases. |
| single-file-backoff-fix | full | 1 | passed | — | 5 / 1 / 0 | — | 5 | 7367 | 10144 | backoffMs passed the three executable cases. |
| multi-file-port-fix | baseline | 1 | passed | — | 6 / 0 / 0 | — | 8 | 8188 | 8481 | Default and explicit port cases passed. |
| multi-file-port-fix | session-context | 1 | passed | — | 7 / 0 / 0 | — | 9 | 9764 | 9463 | Default and explicit port cases passed. |
| multi-file-port-fix | prompt | 1 | passed | — | 6 / 0 / 0 | — | 9 | 9117 | 9914 | Default and explicit port cases passed. |
| multi-file-port-fix | full | 1 | passed | — | 6 / 1 / 0 | — | 9 | 9714 | 11851 | Default and explicit port cases passed. |
| cross-task-handoff | baseline | 1 | passed | — | 6 / 0 / 0 | — | 5 | 6003 | 7024 | The first task must locate the handoff code. handoff.txt must contain the code carried over from the prior task. |
| cross-task-handoff | session-context | 1 | passed | — | 4 / 0 / 0 | — | 2 | 3601 | 3887 | The first task must locate the handoff code. handoff.txt must contain the code carried over from the prior task. |
| cross-task-handoff | prompt | 1 | passed | — | 6 / 0 / 0 | — | 5 | 6216 | 7305 | The first task must locate the handoff code. handoff.txt must contain the code carried over from the prior task. |
| cross-task-handoff | full | 1 | passed | — | 5 / 2 / 0 | — | 3 | 5820 | 7280 | The first task must locate the handoff code. handoff.txt must contain the code carried over from the prior task. |
| context-window-recall | baseline | 1 | passed | — | 13 / 0 / 0 | — | 8 | 16576 | 13802 | Task 1 must return PAGE-1-JUNIPER-162. Task 2 must return PAGE-2-JUNIPER-262. Task 3 must return PAGE-3-JUNIPER-362. Task 4 must return PAGE-4-JUNIPER-462. Task |
| context-window-recall | session-context | 1 | passed | — | 12 / 0 / 2 | — | 6 | 39125 | 15152 | Task 1 must return PAGE-1-JUNIPER-162. Task 2 must return PAGE-2-JUNIPER-262. Task 3 must return PAGE-3-JUNIPER-362. Task 4 must return PAGE-4-JUNIPER-462. Task |
| context-window-recall | prompt | 1 | passed | — | 14 / 0 / 0 | — | 9 | 18441 | 15644 | Task 1 must return PAGE-1-JUNIPER-162. Task 2 must return PAGE-2-JUNIPER-262. Task 3 must return PAGE-3-JUNIPER-362. Task 4 must return PAGE-4-JUNIPER-462. Task |
| context-window-recall | full | 1 | passed | — | 12 / 6 / 2 | — | 6 | 42315 | 20980 | Task 1 must return PAGE-1-JUNIPER-162. Task 2 must return PAGE-2-JUNIPER-262. Task 3 must return PAGE-3-JUNIPER-362. Task 4 must return PAGE-4-JUNIPER-462. Task |
| transient-tool-failure | baseline | 1 | passed | — | 5 / 0 / 0 | — | 4 | 5025 | 4581 | The tool failure should be handled and MAPLE-208 written to lookup-result.txt. |
| transient-tool-failure | session-context | 1 | passed | — | 5 / 0 / 0 | — | 4 | 5025 | 5491 | The tool failure should be handled and MAPLE-208 written to lookup-result.txt. |
| transient-tool-failure | prompt | 1 | passed | — | 5 / 0 / 0 | — | 6 | 5855 | 5642 | The tool failure should be handled and MAPLE-208 written to lookup-result.txt. |
| transient-tool-failure | full | 1 | passed | — | 5 / 1 / 0 | — | 6 | 6289 | 5624 | The tool failure should be handled and MAPLE-208 written to lookup-result.txt. |
| module-dependencies | baseline | 1 | passed | — | 3 / 0 / 0 | — | 4 | 3428 | 4954 | Must identify the ordered imports and both symbols. |
| module-dependencies | session-context | 1 | passed | — | 3 / 0 / 0 | — | 4 | 3656 | 6203 | Must identify the ordered imports and both symbols. |
| module-dependencies | prompt | 1 | passed | — | 3 / 0 / 0 | — | 4 | 3628 | 5230 | Must identify the ordered imports and both symbols. |
| module-dependencies | full | 1 | passed | — | 3 / 1 / 0 | — | 5 | 4364 | 7151 | Must identify the ordered imports and both symbols. |
| call-chain-trace | baseline | 1 | passed | — | 3 / 0 / 0 | — | 5 | 3636 | 4532 | Must trace handle → dispatch → persist and saved:A7. |
| call-chain-trace | session-context | 1 | passed | — | 3 / 0 / 0 | — | 5 | 3556 | 4647 | Must trace handle → dispatch → persist and saved:A7. |
| call-chain-trace | prompt | 1 | passed | — | 4 / 0 / 0 | — | 6 | 5090 | 7247 | Must trace handle → dispatch → persist and saved:A7. |
| call-chain-trace | full | 1 | passed | — | 4 / 1 / 0 | — | 5 | 5326 | 8501 | Must trace handle → dispatch → persist and saved:A7. |
| boundary-condition-fix | baseline | 1 | passed | — | 6 / 0 / 0 | — | 7 | 9097 | 8728 | Boundary cases: negative, empty, above-range, and valid index. |
| boundary-condition-fix | session-context | 1 | passed | — | 6 / 0 / 0 | — | 7 | 9113 | 10147 | Boundary cases: negative, empty, above-range, and valid index. |
| boundary-condition-fix | prompt | 1 | passed | — | 7 / 0 / 0 | — | 7 | 10270 | 10526 | Boundary cases: negative, empty, above-range, and valid index. |
| boundary-condition-fix | full | 1 | passed | — | 9 / 1 / 0 | — | 9 | 16116 | 14214 | Boundary cases: negative, empty, above-range, and valid index. |
| new-function | baseline | 1 | passed | — | 8 / 0 / 0 | — | 9 | 12298 | 10706 | slugify must satisfy four executable cases. |
| new-function | session-context | 1 | passed | — | 8 / 0 / 0 | — | 9 | 12454 | 12911 | slugify must satisfy four executable cases. |
| new-function | prompt | 1 | passed | — | 8 / 0 / 0 | — | 8 | 13103 | 13129 | slugify must satisfy four executable cases. |
| new-function | full | 1 | passed | — | 7 / 1 / 0 | — | 7 | 11540 | 12443 | slugify must satisfy four executable cases. |
| configuration-change | baseline | 1 | passed | — | 5 / 0 / 0 | — | 5 | 5541 | 5436 | Config and executable client must both use retryLimit=4. |
| configuration-change | session-context | 1 | passed | — | 5 / 0 / 0 | — | 5 | 5497 | 5799 | Config and executable client must both use retryLimit=4. |
| configuration-change | prompt | 1 | passed | — | 5 / 0 / 0 | — | 6 | 5970 | 6584 | Config and executable client must both use retryLimit=4. |
| configuration-change | full | 1 | passed | — | 5 / 1 / 0 | — | 5 | 6355 | 5564 | Config and executable client must both use retryLimit=4. |
| unit-test-addition | baseline | 1 | failed | acceptance | 5 / 0 / 0 | — | 6 | 6887 | 7046 | Tests must cover four cases without altering implementation. |
| unit-test-addition | session-context | 1 | failed | acceptance | 5 / 0 / 0 | — | 6 | 6853 | 5824 | Tests must cover four cases without altering implementation. |
| unit-test-addition | prompt | 1 | failed | acceptance | 4 / 0 / 0 | — | 4 | 5187 | 5265 | Tests must cover four cases without altering implementation. |
| unit-test-addition | full | 1 | failed | acceptance | 4 / 1 / 0 | — | 4 | 5804 | 6099 | Tests must cover four cases without altering implementation. |
| code-review | baseline | 1 | passed | — | 3 / 0 / 0 | — | 3 | 4080 | 10417 | Review must identify token logging and loose equality, with fixes; source must stay unchanged. |
| code-review | session-context | 1 | passed | — | 3 / 0 / 0 | — | 3 | 3869 | 8246 | Review must identify token logging and loose equality, with fixes; source must stay unchanged. |
| code-review | prompt | 1 | passed | — | 2 / 0 / 0 | — | 2 | 2711 | 6675 | Review must identify token logging and loose equality, with fixes; source must stay unchanged. |
| code-review | full | 1 | passed | — | 2 / 1 / 0 | — | 2 | 3527 | 10045 | Review must identify token logging and loose equality, with fixes; source must stay unchanged. |
| test-failure-analysis | baseline | 1 | passed | — | 5 / 0 / 0 | — | 6 | 7405 | 8248 | Must diagnose percent-versus-fraction mismatch without changing code. |
| test-failure-analysis | session-context | 1 | passed | — | 5 / 0 / 0 | — | 5 | 6610 | 9713 | Must diagnose percent-versus-fraction mismatch without changing code. |
| test-failure-analysis | prompt | 1 | passed | — | 5 / 0 / 0 | — | 6 | 7751 | 10106 | Must diagnose percent-versus-fraction mismatch without changing code. |
| test-failure-analysis | full | 1 | passed | — | 5 / 1 / 0 | — | 6 | 8380 | 10458 | Must diagnose percent-versus-fraction mismatch without changing code. |
| continuous-modification | baseline | 1 | passed | — | 9 / 0 / 0 | — | 9 | 9875 | 9559 | First change must update only capacity. Both sequential changes must remain valid. |
| continuous-modification | session-context | 1 | passed | — | 8 / 0 / 0 | — | 7 | 10085 | 7324 | First change must update only capacity. Both sequential changes must remain valid. |
| continuous-modification | prompt | 1 | passed | — | 9 / 0 / 0 | — | 9 | 9954 | 11017 | First change must update only capacity. Both sequential changes must remain valid. |
| continuous-modification | full | 1 | passed | — | 7 / 2 / 0 | — | 6 | 10027 | 10373 | First change must update only capacity. Both sequential changes must remain valid. |
| candidate-skills-boundary-audit | baseline | 1 | failed | acceptance | 7 / 0 / 0 | — | 7 | 10563 | 9119 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | session-context | 1 | passed | — | 7 / 0 / 0 | — | 7 | 11257 | 9657 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | prompt | 1 | passed | — | 5 / 0 / 0 | — | 6 | 8025 | 8954 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | full | 1 | passed | — | 6 / 1 / 0 | — | 6 | 9830 | 10824 | All four independent boundary cases must pass. |
| candidate-prompt-requirement-revision | baseline | 1 | passed | — | 11 / 0 / 0 | — | 12 | 14777 | 17196 | Initial retry behavior must pass. Revised exponential behavior must replace the earlier linear behavior. |
| candidate-prompt-requirement-revision | session-context | 1 | passed | — | 8 / 0 / 0 | — | 9 | 14293 | 13084 | Initial retry behavior must pass. Revised exponential behavior must replace the earlier linear behavior. |
| candidate-prompt-requirement-revision | prompt | 1 | failed | acceptance | 5 / 0 / 0 | — | 6 | 6512 | 7843 | Initial retry behavior must pass. |
| candidate-prompt-requirement-revision | full | 1 | passed | — | 11 / 2 / 0 | — | 10 | 22235 | 17148 | Initial retry behavior must pass. Revised exponential behavior must replace the earlier linear behavior. |
| candidate-recovery-partial-write | baseline | 1 | failed | acceptance | 2 / 0 / 0 | — | 0 | 1973 | 2160 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-partial-write | session-context | 1 | passed | — | 7 / 0 / 0 | — | 6 | 8089 | 6889 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-partial-write | prompt | 1 | failed | acceptance | 1 / 0 / 0 | — | 0 | 896 | 843 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-partial-write | full | 1 | passed | — | 5 / 1 / 0 | — | 5 | 6604 | 6928 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| mcp-call | full | 1 | passed | — | 4 / 1 / 0 | — | 4 | 10675 | 4480 | Must call discovered MCP echo tool and persist its exact result. |
| mcp-discovery | full | 1 | passed | — | 4 / 1 / 0 | — | 4 | 10336 | 6412 | The discovered MCP tool must return MCP-CEDAR-931 and the value must be written to mcp-result.txt. |

## Specialized scenarios

| Scenario | Groups | Passed / valid | Completion | Infra errors |
| --- | --- | ---: | ---: | ---: |
| mcp-call | full | 1/1 | 100.0% | 0 |
| mcp-discovery | full | 1/1 | 100.0% | 0 |

Token averages and budget completion use only runs with complete API usage. Infrastructure errors are excluded from completion rates. Specialized scenarios are reported separately. Per-run cap reasons are recorded in JSON and CSV.

## Permission scenarios

- Status: passed
- Unauthorized operation block rate: 100.0%
- Cases matched reference policy: 5/5
- False allows: 0
- False denials: 0
