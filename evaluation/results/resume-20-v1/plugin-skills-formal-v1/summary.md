# MiniHarness Benchmark Results

Runs: 12; created at: 2026-11-14T04:22:58.816Z. Infrastructure errors are excluded from completion-rate denominators.

## Per-task results

| Task | Group | Passed / valid | Completion | Tools / success | Model rounds | API tokens | Latency ms | Skill accuracy | Prompt stages | Context preserved | Context compressed | MCP discovery | MCP recovery | Infra errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| plugin-skills-release-audit | baseline | 0/3 | 0.0% | n/a | 4.0 | 6369 | 9993 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| plugin-skills-release-audit | full | 3/3 | 100.0% | 4.0 | 4.0 | 6817 | 7956 | 100.0% | 100.0% | n/a | n/a | n/a | n/a | 0 |
| plugin-skills-release-audit | full-no-skills | 0/3 | 0.0% | n/a | 4.7 | 6526 | 8649 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| plugin-skills-release-audit | skills | 3/3 | 100.0% | 5.0 | 5.0 | 8226 | 7623 | 100.0% | n/a | n/a | n/a | n/a | n/a | 0 |

## Shared suite totals

| Group | Passed / valid task runs | Completion | Tools / success | Agent rounds | API calls | Tokens / successful task | Amortized tokens / completion | Latency / success ms | Infra errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 0/3 | 0.0% | n/a | 4.0 | 4.0 | n/a | n/a | n/a | 0 |
| full | 3/3 | 100.0% | 4.0 | 4.0 | 5.0 | 6817 | 6817 | 7956 | 0 |
| full-no-skills | 0/3 | 0.0% | n/a | 4.7 | 4.7 | n/a | n/a | n/a | 0 |
| skills | 3/3 | 100.0% | 5.0 | 5.0 | 6.0 | 8226 | 8226 | 7623 | 0 |

### Model request and token breakdown per valid run

| Group | Agent requests | Agent tokens | Skill selection requests | Skill selection tokens | Summary requests | Summary tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 4.0 | 6369 | 0.0 | 0 | 0.0 | 0 |
| full | 4.0 | 6280 | 1.0 | 537 | 0.0 | 0 |
| full-no-skills | 4.7 | 6526 | 0.0 | 0 | 0.0 | 0 |
| skills | 5.0 | 7689 | 1.0 | 537 | 0.0 | 0 |

## Group comparison (shared common tasks)

| Group | Completion | Δ completion | Tokens / success | Amortized tokens / completion | API calls / success | ≤25k completion | ≤50k completion | ≤100k completion | Δ latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 0.0% | +0.0 pp | n/a | n/a | n/a | 0.0% | 0.0% | 0.0% | n/a |
| full | 100.0% | +100.0 pp | 6817 | 6817 | 5.0 | 100.0% | 100.0% | 100.0% | n/a |
| full-no-skills | 0.0% | +0.0 pp | n/a | n/a | n/a | 0.0% | 0.0% | 0.0% | n/a |
| skills | 100.0% | +100.0 pp | 8226 | 8226 | 6.0 | 100.0% | 100.0% | 100.0% | n/a |

Deltas are relative to the baseline group; negative token, latency, and API-call deltas are improvements. Completion deltas are percentage points.

### Full-minus-one attribution contrasts

| Contrast | Completion difference | Amortized token difference | API calls / successful task difference |
| --- | ---: | ---: | ---: |
| Full − baseline | 100.0 pp | n/a | n/a |
| Full − full-no-skills | 100.0 pp | n/a | n/a |

## Plugin-gated task effects

| Task | Group | Passed / valid | Tokens / success | Tools / success | Agent rounds | API calls | Summary calls |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| plugin-skills-release-audit | baseline | 0/3 | n/a | n/a | 4.0 | 4.0 | 0.0 |
| plugin-skills-release-audit | skills | 3/3 | 8226 | 5.0 | 5.0 | 6.0 | 0.0 |
| plugin-skills-release-audit | full | 3/3 | 6817 | 4.0 | 4.0 | 5.0 | 0.0 |
| plugin-skills-release-audit | full-no-skills | 0/3 | n/a | n/a | 4.7 | 4.7 | 0.0 |

## Individual runs

| Task | Group | Repeat | Status | Failure kind | Agent / Skill / Summary requests | Cap reason | Tools | API tokens | Latency ms | Acceptance detail |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| plugin-skills-release-audit | baseline | 1 | failed | acceptance | 4 / 0 / 0 | — | 5 | 7279 | 12680 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | baseline | 2 | failed | acceptance | 4 / 0 / 0 | — | 5 | 5849 | 8488 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | baseline | 3 | failed | acceptance | 4 / 0 / 0 | — | 5 | 5978 | 8810 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | skills | 1 | passed | — | 6 / 1 / 0 | — | 6 | 10156 | 8303 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | skills | 2 | passed | — | 4 / 1 / 0 | — | 4 | 6177 | 6866 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | skills | 3 | passed | — | 5 / 1 / 0 | — | 5 | 8344 | 7699 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full | 1 | passed | — | 4 / 1 / 0 | — | 4 | 6877 | 8116 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full | 2 | passed | — | 4 / 1 / 0 | — | 4 | 6831 | 8179 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full | 3 | passed | — | 4 / 1 / 0 | — | 4 | 6742 | 7572 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full-no-skills | 1 | failed | acceptance | 5 / 0 / 0 | — | 5 | 7119 | 9543 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full-no-skills | 2 | failed | acceptance | 5 / 0 / 0 | — | 5 | 7227 | 10176 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |
| plugin-skills-release-audit | full-no-skills | 3 | failed | acceptance | 4 / 0 / 0 | — | 4 | 5232 | 6229 | audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest. |

Token averages and budget completion use only runs with complete API usage. Infrastructure errors are excluded from completion rates. Specialized scenarios are reported separately. Per-run cap reasons are recorded in JSON and CSV.

## Permission scenarios

- Status: passed
- Unauthorized operation block rate: 100.0%
- Cases matched reference policy: 5/5
- False allows: 0
- False denials: 0
