# MiniHarness Benchmark Results

Runs: 36; created at: 2026-11-14T04:34:24.717Z. Infrastructure errors are excluded from completion-rate denominators.

## Per-task results

| Task | Group | Passed / valid | Completion | Tools / success | Model rounds | API tokens | Latency ms | Skill accuracy | Prompt stages | Context preserved | Context compressed | MCP discovery | MCP recovery | Infra errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| plugin-context-cross-task-seal | baseline | 0/3 | 0.0% | n/a | 5.3 | 4637 | 7175 | n/a | n/a | 100.0% | n/a | n/a | n/a | 0 |
| plugin-context-cross-task-seal | full | 2/3 | 66.7% | 7.0 | 7.0 | 9696 | 32148 | n/a | 100.0% | 100.0% | n/a | n/a | n/a | 0 |
| plugin-context-cross-task-seal | prompt | 0/3 | 0.0% | n/a | 7.0 | 7545 | 10493 | n/a | 100.0% | 100.0% | n/a | n/a | n/a | 0 |
| plugin-context-cross-task-seal | session-context | 3/3 | 100.0% | 4.0 | 6.0 | 5681 | 5918 | n/a | n/a | 100.0% | n/a | n/a | n/a | 0 |
| plugin-prompt-repair-contract | baseline | 0/3 | 0.0% | n/a | 7.0 | 9477 | 9069 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| plugin-prompt-repair-contract | full | 3/3 | 100.0% | 11.3 | 8.3 | 17134 | 13625 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| plugin-prompt-repair-contract | prompt | 3/3 | 100.0% | 11.0 | 9.3 | 17013 | 11646 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| plugin-prompt-repair-contract | session-context | 0/3 | 0.0% | n/a | 6.0 | 7302 | 6667 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| plugin-skills-release-audit | baseline | 0/3 | 0.0% | n/a | 4.0 | 6071 | 9357 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| plugin-skills-release-audit | full | 3/3 | 100.0% | 4.0 | 4.0 | 6923 | 8362 | 100.0% | 100.0% | n/a | n/a | n/a | n/a | 0 |
| plugin-skills-release-audit | prompt | 0/3 | 0.0% | n/a | 5.0 | 7371 | 10705 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| plugin-skills-release-audit | session-context | 0/3 | 0.0% | n/a | 4.0 | 5900 | 8334 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |

## Shared suite totals

| Group | Passed / valid task runs | Completion | Tools / success | Agent rounds | API calls | Tokens / successful task | Amortized tokens / completion | Latency / success ms | Infra errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 0/9 | 0.0% | n/a | 5.4 | 5.4 | n/a | n/a | n/a | 0 |
| full | 8/9 | 88.9% | 7.5 | 6.4 | 7.7 | 11946 | 12657 | 19555 | 0 |
| prompt | 3/9 | 33.3% | 11.0 | 7.1 | 7.1 | 17013 | 31929 | 11646 | 0 |
| session-context | 3/9 | 33.3% | 4.0 | 5.3 | 5.3 | 5681 | 18883 | 5918 | 0 |

### Model request and token breakdown per valid run

| Group | Agent requests | Agent tokens | Skill selection requests | Skill selection tokens | Summary requests | Summary tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 5.4 | 6728 | 0.0 | 0 | 0.0 | 0 |
| full | 6.4 | 10612 | 1.2 | 639 | 0.0 | 0 |
| prompt | 7.1 | 10643 | 0.0 | 0 | 0.0 | 0 |
| session-context | 5.3 | 6294 | 0.0 | 0 | 0.0 | 0 |

## Group comparison (shared common tasks)

| Group | Completion | Δ completion | Tokens / success | Amortized tokens / completion | API calls / success | ≤25k completion | ≤50k completion | ≤100k completion | Δ latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 0.0% | +0.0 pp | n/a | n/a | n/a | 0.0% | 0.0% | 0.0% | n/a |
| full | 88.9% | +88.9 pp | 11946 | 12657 | 7.9 | 88.9% | 88.9% | 88.9% | n/a |
| prompt | 33.3% | +33.3 pp | 17013 | 31929 | 9.3 | 33.3% | 33.3% | 33.3% | n/a |
| session-context | 33.3% | +33.3 pp | 5681 | 18883 | 6.0 | 33.3% | 33.3% | 33.3% | n/a |

Deltas are relative to the baseline group; negative token, latency, and API-call deltas are improvements. Completion deltas are percentage points.

### Full-minus-one attribution contrasts

| Contrast | Completion difference | Amortized token difference | API calls / successful task difference |
| --- | ---: | ---: | ---: |
| Full − baseline | 88.9 pp | n/a | n/a |

## Plugin-gated task effects

| Task | Group | Passed / valid | Tokens / success | Tools / success | Agent rounds | API calls | Summary calls |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| plugin-skills-release-audit | baseline | 0/3 | n/a | n/a | 4.0 | 4.0 | 0.0 |
| plugin-skills-release-audit | session-context | 0/3 | n/a | n/a | 4.0 | 4.0 | 0.0 |
| plugin-skills-release-audit | prompt | 0/3 | n/a | n/a | 5.0 | 5.0 | 0.0 |
| plugin-skills-release-audit | full | 3/3 | 6923 | 4.0 | 4.0 | 5.0 | 0.0 |
| plugin-context-cross-task-seal | baseline | 0/3 | n/a | n/a | 5.3 | 5.3 | 0.0 |
| plugin-context-cross-task-seal | session-context | 3/3 | 5681 | 4.0 | 6.0 | 6.0 | 0.0 |
| plugin-context-cross-task-seal | prompt | 0/3 | n/a | n/a | 7.0 | 7.0 | 0.0 |
| plugin-context-cross-task-seal | full | 2/3 | 11699 | 7.0 | 7.0 | 8.7 | 0.0 |
| plugin-prompt-repair-contract | baseline | 0/3 | n/a | n/a | 7.0 | 7.0 | 0.0 |
| plugin-prompt-repair-contract | session-context | 0/3 | n/a | n/a | 6.0 | 6.0 | 0.0 |
| plugin-prompt-repair-contract | prompt | 3/3 | 17013 | 11.0 | 9.3 | 9.3 | 0.0 |
| plugin-prompt-repair-contract | full | 3/3 | 17134 | 11.3 | 8.3 | 9.3 | 0.0 |

## Individual runs

| Task | Group | Repeat | Status | Failure kind | Agent / Skill / Summary requests | Cap reason | Tools | API tokens | Latency ms | Acceptance detail |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| plugin-skills-release-audit | baseline | 1 | failed | acceptance | 4 / 0 / 0 | — | 5 | 6351 | 10351 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | baseline | 2 | failed | acceptance | 4 / 0 / 0 | — | 5 | 5980 | 8393 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | baseline | 3 | failed | acceptance | 4 / 0 / 0 | — | 5 | 5882 | 9326 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | session-context | 1 | failed | acceptance | 4 / 0 / 0 | — | 5 | 5746 | 7936 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | session-context | 2 | failed | acceptance | 4 / 0 / 0 | — | 5 | 6060 | 8708 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | session-context | 3 | failed | acceptance | 4 / 0 / 0 | — | 5 | 5895 | 8358 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | prompt | 1 | failed | acceptance | 5 / 0 / 0 | — | 5 | 7189 | 9914 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | prompt | 2 | failed | acceptance | 5 / 0 / 0 | — | 5 | 7392 | 10096 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | prompt | 3 | failed | acceptance | 5 / 0 / 0 | — | 5 | 7532 | 12104 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full | 1 | passed | — | 4 / 1 / 0 | — | 4 | 7034 | 9243 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full | 2 | passed | — | 4 / 1 / 0 | — | 4 | 6684 | 7311 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full | 3 | passed | — | 4 / 1 / 0 | — | 4 | 7050 | 8532 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-context-cross-task-seal | baseline | 1 | failed | acceptance | 5 / 0 / 0 | — | 4 | 4057 | 5044 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | baseline | 2 | failed | acceptance | 5 / 0 / 0 | — | 4 | 4309 | 6541 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | baseline | 3 | failed | acceptance | 6 / 0 / 0 | — | 4 | 5545 | 9939 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | session-context | 1 | passed | — | 6 / 0 / 0 | — | 4 | 5671 | 5392 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | session-context | 2 | passed | — | 6 / 0 / 0 | — | 4 | 5674 | 5633 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | session-context | 3 | passed | — | 6 / 0 / 0 | — | 4 | 5698 | 6728 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | prompt | 1 | failed | acceptance | 7 / 0 / 0 | — | 6 | 7811 | 12024 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | prompt | 2 | failed | acceptance | 7 / 0 / 0 | — | 6 | 7350 | 9326 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | prompt | 3 | failed | acceptance | 7 / 0 / 0 | — | 6 | 7474 | 10130 | release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | full | 1 | passed | — | 8 / 2 / 0 | — | 7 | 11712 | 11517 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-context-cross-task-seal | full | 2 | failed | acceptance | 5 / 1 / 0 | — | 4 | 5690 | 5963 | handoff.txt must contain SEAL: AMBER-9-QUARRY. |
| plugin-context-cross-task-seal | full | 3 | passed | — | 8 / 2 / 0 | — | 7 | 11686 | 78965 | handoff.txt must contain SEAL: AMBER-9-QUARRY. release.md must recall the earlier seal without rereading tools. |
| plugin-prompt-repair-contract | baseline | 1 | failed | acceptance | 7 / 0 / 0 | — | 8 | 9944 | 8979 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | baseline | 2 | failed | acceptance | 7 / 0 / 0 | — | 8 | 9316 | 9718 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | baseline | 3 | failed | acceptance | 7 / 0 / 0 | — | 7 | 9171 | 8509 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | session-context | 1 | failed | acceptance | 6 / 0 / 0 | — | 6 | 7213 | 6033 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | session-context | 2 | failed | acceptance | 6 / 0 / 0 | — | 7 | 7488 | 6711 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | session-context | 3 | failed | acceptance | 6 / 0 / 0 | — | 6 | 7205 | 7256 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | prompt | 1 | passed | — | 9 / 0 / 0 | — | 11 | 16312 | 10905 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | prompt | 2 | passed | — | 9 / 0 / 0 | — | 11 | 16078 | 11826 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | prompt | 3 | passed | — | 10 / 0 / 0 | — | 11 | 18650 | 12206 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full | 1 | passed | — | 9 / 1 / 0 | — | 12 | 19669 | 13615 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full | 2 | passed | — | 8 / 1 / 0 | — | 11 | 15682 | 13363 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |
| plugin-prompt-repair-contract | full | 3 | passed | — | 8 / 1 / 0 | — | 11 | 16052 | 13896 | repair-plan.md and verification.md must satisfy the repair-contract protocol. |

Token averages and budget completion use only runs with complete API usage. Infrastructure errors are excluded from completion rates. Specialized scenarios are reported separately. Per-run cap reasons are recorded in JSON and CSV.

## Permission scenarios

- Status: passed
- Unauthorized operation block rate: 100.0%
- Cases matched reference policy: 5/5
- False allows: 0
- False denials: 0
