# MiniHarness Benchmark Results

Runs: 12; created at: 2026-11-14T04:24:45.046Z. Infrastructure errors are excluded from completion-rate denominators.

## Per-task results

| Task | Group | Passed / valid | Completion | Tools / success | Model rounds | API tokens | Latency ms | Skill accuracy | Prompt stages | Context preserved | Context compressed | MCP discovery | MCP recovery | Infra errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| plugin-context-cross-task-seal | baseline | 0/3 | 0.0% | n/a | 5.7 | 4814 | 6789 | n/a | n/a | 100.0% | n/a | n/a | n/a | 0 |
| plugin-context-cross-task-seal | full | 3/3 | 100.0% | 6.7 | 7.7 | 11280 | 10435 | n/a | 100.0% | 100.0% | n/a | n/a | n/a | 0 |
| plugin-context-cross-task-seal | full-no-context | 0/3 | 0.0% | n/a | 7.0 | 9254 | 11820 | n/a | 100.0% | 100.0% | n/a | n/a | n/a | 0 |
| plugin-context-cross-task-seal | session-context | 3/3 | 100.0% | 4.3 | 6.0 | 5889 | 5975 | n/a | n/a | 100.0% | n/a | n/a | n/a | 0 |

## Shared suite totals

| Group | Passed / valid task runs | Completion | Tools / success | Agent rounds | API calls | Tokens / successful task | Amortized tokens / completion | Latency / success ms | Infra errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 0/3 | 0.0% | n/a | 5.7 | 5.7 | n/a | n/a | n/a | 0 |
| full | 3/3 | 100.0% | 6.7 | 7.7 | 9.7 | 11280 | 11280 | 10435 | 0 |
| full-no-context | 0/3 | 0.0% | n/a | 7.0 | 9.0 | n/a | n/a | n/a | 0 |
| session-context | 3/3 | 100.0% | 4.3 | 6.0 | 6.0 | 5889 | 5889 | 5975 | 0 |

### Model request and token breakdown per valid run

| Group | Agent requests | Agent tokens | Skill selection requests | Skill selection tokens | Summary requests | Summary tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 5.7 | 4814 | 0.0 | 0 | 0.0 | 0 |
| full | 7.7 | 10245 | 2.0 | 1035 | 0.0 | 0 |
| full-no-context | 7.0 | 8219 | 2.0 | 1035 | 0.0 | 0 |
| session-context | 6.0 | 5889 | 0.0 | 0 | 0.0 | 0 |

## Group comparison (shared common tasks)

| Group | Completion | Δ completion | Tokens / success | Amortized tokens / completion | API calls / success | ≤25k completion | ≤50k completion | ≤100k completion | Δ latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 0.0% | +0.0 pp | n/a | n/a | n/a | 0.0% | 0.0% | 0.0% | n/a |
| full | 100.0% | +100.0 pp | 11280 | 11280 | 9.7 | 100.0% | 100.0% | 100.0% | n/a |
| full-no-context | 0.0% | +0.0 pp | n/a | n/a | n/a | 0.0% | 0.0% | 0.0% | n/a |
| session-context | 100.0% | +100.0 pp | 5889 | 5889 | 6.0 | 100.0% | 100.0% | 100.0% | n/a |

Deltas are relative to the baseline group; negative token, latency, and API-call deltas are improvements. Completion deltas are percentage points.

### Full-minus-one attribution contrasts

| Contrast | Completion difference | Amortized token difference | API calls / successful task difference |
| --- | ---: | ---: | ---: |
| Full − baseline | 100.0 pp | n/a | n/a |
| Full − full-no-context | 100.0 pp | n/a | n/a |

## Plugin-gated task effects

| Task | Group | Passed / valid | Tokens / success | Tools / success | Agent rounds | API calls | Summary calls |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| plugin-context-cross-task-seal | baseline | 0/3 | n/a | n/a | 5.7 | 5.7 | 0.0 |
| plugin-context-cross-task-seal | session-context | 3/3 | 5889 | 4.3 | 6.0 | 6.0 | 0.0 |
| plugin-context-cross-task-seal | full | 3/3 | 11280 | 6.7 | 7.7 | 9.7 | 0.0 |
| plugin-context-cross-task-seal | full-no-context | 0/3 | n/a | n/a | 7.0 | 9.0 | 0.0 |

## Individual runs

| Task | Group | Repeat | Status | Failure kind | Agent / Skill / Summary requests | Cap reason | Tools | API tokens | Latency ms | Acceptance detail |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| plugin-context-cross-task-seal | baseline | 1 | failed | acceptance | 6 / 0 / 0 | — | 4 | 5139 | 6904 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | baseline | 2 | failed | acceptance | 5 / 0 / 0 | — | 4 | 4210 | 6726 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | baseline | 3 | failed | acceptance | 6 / 0 / 0 | — | 4 | 5093 | 6736 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | session-context | 1 | passed | — | 6 / 0 / 0 | — | 4 | 5649 | 5539 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | session-context | 2 | passed | — | 6 / 0 / 0 | — | 4 | 5674 | 5690 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | session-context | 3 | passed | — | 6 / 0 / 0 | — | 5 | 6343 | 6695 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | full | 1 | passed | — | 8 / 2 / 0 | — | 7 | 11840 | 11211 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | full | 2 | passed | — | 8 / 2 / 0 | — | 7 | 11943 | 10120 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | full | 3 | passed | — | 7 / 2 / 0 | — | 6 | 10058 | 9975 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | full-no-context | 1 | failed | acceptance | 7 / 2 / 0 | — | 6 | 9096 | 10845 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | full-no-context | 2 | failed | acceptance | 7 / 2 / 0 | — | 6 | 9181 | 12383 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | full-no-context | 3 | failed | acceptance | 7 / 2 / 0 | — | 6 | 9484 | 12233 | release.md must recall the earlier seal without rereading tools. |

Token averages and budget completion use only runs with complete API usage. Infrastructure errors are excluded from completion rates. Specialized scenarios are reported separately. Per-run cap reasons are recorded in JSON and CSV.

## Permission scenarios

- Status: passed
- Unauthorized operation block rate: 100.0%
- Cases matched reference policy: 5/5
- False allows: 0
- False denials: 0
