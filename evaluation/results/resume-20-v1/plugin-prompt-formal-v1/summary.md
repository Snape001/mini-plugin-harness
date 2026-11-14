# MiniHarness Benchmark Results

Runs: 12; created at: 2026-11-14T04:26:53.244Z. Infrastructure errors are excluded from completion-rate denominators.

## Per-task results

| Task | Group | Passed / valid | Completion | Tools / success | Model rounds | API tokens | Latency ms | Skill accuracy | Prompt stages | Context preserved | Context compressed | MCP discovery | MCP recovery | Infra errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| plugin-prompt-repair-contract | baseline | 0/3 | 0.0% | n/a | 6.7 | 8650 | 7742 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| plugin-prompt-repair-contract | full | 3/3 | 100.0% | 11.3 | 9.0 | 18752 | 14629 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| plugin-prompt-repair-contract | full-no-prompt | 0/3 | 0.0% | n/a | 7.0 | 11150 | 9293 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| plugin-prompt-repair-contract | prompt | 3/3 | 100.0% | 10.7 | 8.3 | 14798 | 10660 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |

## Shared suite totals

| Group | Passed / valid task runs | Completion | Tools / success | Agent rounds | API calls | Tokens / successful task | Amortized tokens / completion | Latency / success ms | Infra errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 0/3 | 0.0% | n/a | 6.7 | 6.7 | n/a | n/a | n/a | 0 |
| full | 3/3 | 100.0% | 11.3 | 9.0 | 10.0 | 18752 | 18752 | 14629 | 0 |
| full-no-prompt | 0/3 | 0.0% | n/a | 7.0 | 8.0 | n/a | n/a | n/a | 0 |
| prompt | 3/3 | 100.0% | 10.7 | 8.3 | 8.3 | 14798 | 14798 | 10660 | 0 |

### Model request and token breakdown per valid run

| Group | Agent requests | Agent tokens | Skill selection requests | Skill selection tokens | Summary requests | Summary tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 6.7 | 8650 | 0.0 | 0 | 0.0 | 0 |
| full | 9.0 | 18233 | 1.0 | 519 | 0.0 | 0 |
| full-no-prompt | 7.0 | 10631 | 1.0 | 519 | 0.0 | 0 |
| prompt | 8.3 | 14798 | 0.0 | 0 | 0.0 | 0 |

## Group comparison (shared common tasks)

| Group | Completion | Δ completion | Tokens / success | Amortized tokens / completion | API calls / success | ≤25k completion | ≤50k completion | ≤100k completion | Δ latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 0.0% | +0.0 pp | n/a | n/a | n/a | 0.0% | 0.0% | 0.0% | n/a |
| full | 100.0% | +100.0 pp | 18752 | 18752 | 10.0 | 100.0% | 100.0% | 100.0% | n/a |
| full-no-prompt | 0.0% | +0.0 pp | n/a | n/a | n/a | 0.0% | 0.0% | 0.0% | n/a |
| prompt | 100.0% | +100.0 pp | 14798 | 14798 | 8.3 | 100.0% | 100.0% | 100.0% | n/a |

Deltas are relative to the baseline group; negative token, latency, and API-call deltas are improvements. Completion deltas are percentage points.

### Full-minus-one attribution contrasts

| Contrast | Completion difference | Amortized token difference | API calls / successful task difference |
| --- | ---: | ---: | ---: |
| Full − baseline | 100.0 pp | n/a | n/a |
| Full − full-no-prompt | 100.0 pp | n/a | n/a |

## Plugin-gated task effects

| Task | Group | Passed / valid | Tokens / success | Tools / success | Agent rounds | API calls | Summary calls |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| plugin-prompt-repair-contract | baseline | 0/3 | n/a | n/a | 6.7 | 6.7 | 0.0 |
| plugin-prompt-repair-contract | prompt | 3/3 | 14798 | 10.7 | 8.3 | 8.3 | 0.0 |
| plugin-prompt-repair-contract | full | 3/3 | 18752 | 11.3 | 9.0 | 10.0 | 0.0 |
| plugin-prompt-repair-contract | full-no-prompt | 0/3 | n/a | n/a | 7.0 | 8.0 | 0.0 |

## Individual runs

| Task | Group | Repeat | Status | Failure kind | Agent / Skill / Summary requests | Cap reason | Tools | API tokens | Latency ms | Acceptance detail |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| plugin-prompt-repair-contract | baseline | 1 | failed | acceptance | 6 / 0 / 0 | — | 6 | 7224 | 6748 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | baseline | 2 | failed | acceptance | 7 / 0 / 0 | — | 8 | 9543 | 7539 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | baseline | 3 | failed | acceptance | 7 / 0 / 0 | — | 7 | 9184 | 8939 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | prompt | 1 | passed | — | 7 / 0 / 0 | — | 10 | 11658 | 9161 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | prompt | 2 | passed | — | 9 / 0 / 0 | — | 11 | 16467 | 12817 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | prompt | 3 | passed | — | 9 / 0 / 0 | — | 11 | 16270 | 10002 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full | 1 | passed | — | 9 / 1 / 0 | — | 12 | 18925 | 14729 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full | 2 | passed | — | 10 / 1 / 0 | — | 11 | 21548 | 16406 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full | 3 | passed | — | 8 / 1 / 0 | — | 11 | 15784 | 12752 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full-no-prompt | 1 | failed | acceptance | 7 / 1 / 0 | — | 8 | 11109 | 9950 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full-no-prompt | 2 | failed | acceptance | 7 / 1 / 0 | — | 8 | 11203 | 8725 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full-no-prompt | 3 | failed | acceptance | 7 / 1 / 0 | — | 8 | 11137 | 9204 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |

Token averages and budget completion use only runs with complete API usage. Infrastructure errors are excluded from completion rates. Specialized scenarios are reported separately. Per-run cap reasons are recorded in JSON and CSV.

## Permission scenarios

- Status: passed
- Unauthorized operation block rate: 100.0%
- Cases matched reference policy: 5/5
- False allows: 0
- False denials: 0
