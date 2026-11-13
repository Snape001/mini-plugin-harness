# MiniHarness Benchmark Results

Runs: 54; created at: 2026-11-13T13:41:35.582Z. Infrastructure errors are excluded from completion-rate denominators.

## Per-task results

| Task | Group | Passed / valid | Completion | Tools / success | Model rounds | API tokens | Latency ms | Skill accuracy | Prompt stages | Context preserved | Context compressed | MCP discovery | MCP recovery | Infra errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| candidate-prompt-requirement-revision | baseline | 1/3 | 33.3% | 15.0 | 8.0 | 11232 | 11946 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-requirement-revision | full | 3/3 | 100.0% | 36.0 | 27.3 | 116441 | 41260 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-stage-config | baseline | 3/3 | 100.0% | 10.0 | 9.7 | 10793 | 9428 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-stage-config | full | 3/3 | 100.0% | 9.0 | 8.3 | 14352 | 11840 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-tool-failure-repair | baseline | 3/3 | 100.0% | 7.0 | 6.0 | 8485 | 8075 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-prompt-tool-failure-repair | full | 3/3 | 100.0% | 8.7 | 7.0 | 10859 | 9102 | n/a | 100.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-idempotent-retry | baseline | 0/3 | 0.0% | n/a | 1.3 | 1194 | 1112 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-idempotent-retry | full | 3/3 | 100.0% | 7.3 | 6.7 | 8947 | 9086 | n/a | 0.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | baseline | 0/3 | 0.0% | n/a | 1.0 | 864 | 744 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-partial-write | full | 3/3 | 100.0% | 7.7 | 6.3 | 8488 | 7428 | n/a | 0.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-sequential-checkpoint | baseline | 0/3 | 0.0% | n/a | 2.0 | 1825 | 1673 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-recovery-sequential-checkpoint | full | 3/3 | 100.0% | 7.0 | 6.7 | 8752 | 6995 | n/a | 0.0% | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | baseline | 3/3 | 100.0% | 22.3 | 22.3 | 84376 | 27856 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-boundary-audit | full | 2/3 | 66.7% | 24.0 | 25.7 | 129390 | 39759 | 0.0% | 33.3% | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-cross-file-boundary | baseline | 3/3 | 100.0% | 12.3 | 9.7 | 19795 | 13226 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-cross-file-boundary | full | 2/3 | 66.7% | 8.5 | 24.7 | 94466 | 25699 | 100.0% | 66.7% | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-review-call-chain | baseline | 3/3 | 100.0% | 3.3 | 2.7 | 3606 | 8220 | n/a | n/a | n/a | n/a | n/a | n/a | 0 |
| candidate-skills-review-call-chain | full | 3/3 | 100.0% | 6.7 | 5.7 | 9395 | 12101 | 100.0% | 100.0% | n/a | n/a | n/a | n/a | 0 |

## Shared suite totals

| Group | Passed / valid task runs | Completion | Tools / success | Agent rounds | API calls | Tokens / successful task | Amortized tokens / completion | Latency / success ms | Infra errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 16/27 | 59.3% | 11.3 | 7.0 | 7.0 | 24995 | 26657 | 13682 | 0 |
| full | 25/27 | 92.6% | 12.5 | 13.1 | 15.0 | 27840 | 48131 | 14895 | 0 |

### Model request and token breakdown per valid run

| Group | Agent requests | Agent tokens | Skill selection requests | Skill selection tokens | Summary requests | Summary tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 7.0 | 15797 | 0.0 | 0 | 0.0 | 0 |
| full | 13.1 | 43378 | 1.2 | 605 | 0.6 | 583 |

## Group comparison (shared common tasks)

| Group | Completion | Δ completion | Tokens / success | Amortized tokens / completion | API calls / success | ≤25k completion | ≤50k completion | ≤100k completion | Δ latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 59.3% | +0.0 pp | 24995 | 26657 | 10.3 | 51.9% | 51.9% | 51.9% | +0.0% |
| full | 92.6% | +33.3 pp | 27840 | 48131 | 11.7 | 77.8% | 81.5% | 81.5% | +8.9% |

Deltas are relative to the baseline group; negative token, latency, and API-call deltas are improvements. Completion deltas are percentage points.

### Full-minus-one attribution contrasts

| Contrast | Completion difference | Amortized token difference | API calls / successful task difference |
| --- | ---: | ---: | ---: |
| Full − baseline | 33.3 pp | 21474 | 1.4 |

## Individual runs

| Task | Group | Repeat | Status | Failure kind | Agent / Skill / Summary requests | Cap reason | Tools | API tokens | Latency ms | Acceptance detail |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| candidate-skills-cross-file-boundary | baseline | 1 | passed | — | 7 / 0 / 0 | — | 9 | 12491 | 10301 | Cross-file percentage contract must satisfy 0%, 20%, and 100%. |
| candidate-skills-cross-file-boundary | baseline | 2 | passed | — | 11 / 0 / 0 | — | 14 | 23811 | 14929 | Cross-file percentage contract must satisfy 0%, 20%, and 100%. |
| candidate-skills-cross-file-boundary | baseline | 3 | passed | — | 11 / 0 / 0 | — | 14 | 23084 | 14449 | Cross-file percentage contract must satisfy 0%, 20%, and 100%. |
| candidate-skills-cross-file-boundary | full | 1 | failed | model_execution | 59 / 1 / 0 | token-safety-cap | 59 | 257017 | 53103 | Evaluation token safety cap exceeded (250000) |
| candidate-skills-cross-file-boundary | full | 2 | passed | — | 8 / 1 / 0 | — | 9 | 14374 | 12375 | Cross-file percentage contract must satisfy 0%, 20%, and 100%. |
| candidate-skills-cross-file-boundary | full | 3 | passed | — | 7 / 1 / 0 | — | 8 | 12008 | 11618 | Cross-file percentage contract must satisfy 0%, 20%, and 100%. |
| candidate-skills-boundary-audit | baseline | 1 | passed | — | 33 / 0 / 0 | — | 33 | 139285 | 38928 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | baseline | 2 | passed | — | 6 / 0 / 0 | — | 6 | 9196 | 8836 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | baseline | 3 | passed | — | 28 / 0 / 0 | — | 28 | 104648 | 35804 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | full | 1 | passed | — | 25 / 1 / 1 | — | 39 | 122101 | 41158 | All four independent boundary cases must pass. |
| candidate-skills-boundary-audit | full | 2 | failed | model_execution | 44 / 1 / 8 | token-safety-cap | 46 | 250263 | 64337 | Evaluation token safety cap exceeded (250000) |
| candidate-skills-boundary-audit | full | 3 | passed | — | 8 / 1 / 0 | — | 9 | 15806 | 13783 | All four independent boundary cases must pass. |
| candidate-skills-review-call-chain | baseline | 1 | passed | — | 3 / 0 / 0 | — | 3 | 3890 | 9308 | Must identify credential logging and missing ownership authorization without edits. |
| candidate-skills-review-call-chain | baseline | 2 | passed | — | 3 / 0 / 0 | — | 4 | 4066 | 7934 | Must identify credential logging and missing ownership authorization without edits. |
| candidate-skills-review-call-chain | baseline | 3 | passed | — | 2 / 0 / 0 | — | 3 | 2863 | 7419 | Must identify credential logging and missing ownership authorization without edits. |
| candidate-skills-review-call-chain | full | 1 | passed | — | 7 / 1 / 0 | — | 8 | 13234 | 15749 | Must identify credential logging and missing ownership authorization without edits. |
| candidate-skills-review-call-chain | full | 2 | passed | — | 5 / 1 / 0 | — | 6 | 7531 | 10019 | Must identify credential logging and missing ownership authorization without edits. |
| candidate-skills-review-call-chain | full | 3 | passed | — | 5 / 1 / 0 | — | 6 | 7419 | 10535 | Must identify credential logging and missing ownership authorization without edits. |
| candidate-prompt-requirement-revision | baseline | 1 | passed | — | 13 / 0 / 0 | — | 15 | 18753 | 18496 | Initial retry behavior must pass. Revised exponential behavior must replace the earlier linear behavior. |
| candidate-prompt-requirement-revision | baseline | 2 | failed | acceptance | 6 / 0 / 0 | — | 7 | 8246 | 8659 | Initial retry behavior must pass. |
| candidate-prompt-requirement-revision | baseline | 3 | failed | acceptance | 5 / 0 / 0 | — | 6 | 6698 | 8683 | Initial retry behavior must pass. |
| candidate-prompt-requirement-revision | full | 1 | passed | — | 38 / 2 / 8 | — | 57 | 191568 | 64435 | Initial retry behavior must pass. Revised exponential behavior must replace the earlier linear behavior. |
| candidate-prompt-requirement-revision | full | 2 | passed | — | 14 / 2 / 0 | — | 15 | 31285 | 19055 | Initial retry behavior must pass. Revised exponential behavior must replace the earlier linear behavior. |
| candidate-prompt-requirement-revision | full | 3 | passed | — | 30 / 2 / 0 | — | 36 | 126471 | 40290 | Initial retry behavior must pass. Revised exponential behavior must replace the earlier linear behavior. |
| candidate-prompt-tool-failure-repair | baseline | 1 | passed | — | 6 / 0 / 0 | — | 7 | 8453 | 7752 | The original node:test assertion must pass. |
| candidate-prompt-tool-failure-repair | baseline | 2 | passed | — | 6 / 0 / 0 | — | 7 | 8430 | 7847 | The original node:test assertion must pass. |
| candidate-prompt-tool-failure-repair | baseline | 3 | passed | — | 6 / 0 / 0 | — | 7 | 8573 | 8627 | The original node:test assertion must pass. |
| candidate-prompt-tool-failure-repair | full | 1 | passed | — | 7 / 1 / 0 | — | 9 | 11029 | 9744 | The original node:test assertion must pass. |
| candidate-prompt-tool-failure-repair | full | 2 | passed | — | 7 / 1 / 0 | — | 8 | 10702 | 9109 | The original node:test assertion must pass. |
| candidate-prompt-tool-failure-repair | full | 3 | passed | — | 7 / 1 / 0 | — | 9 | 10845 | 8452 | The original node:test assertion must pass. |
| candidate-prompt-stage-config | baseline | 1 | passed | — | 10 / 0 / 0 | — | 10 | 11169 | 10364 | Stage one must change only retries. Final configuration must preserve both sequential requirements. |
| candidate-prompt-stage-config | baseline | 2 | passed | — | 10 / 0 / 0 | — | 11 | 11599 | 8751 | Stage one must change only retries. Final configuration must preserve both sequential requirements. |
| candidate-prompt-stage-config | baseline | 3 | passed | — | 9 / 0 / 0 | — | 9 | 9612 | 9168 | Stage one must change only retries. Final configuration must preserve both sequential requirements. |
| candidate-prompt-stage-config | full | 1 | passed | — | 8 / 2 / 0 | — | 8 | 13076 | 10443 | Stage one must change only retries. Final configuration must preserve both sequential requirements. |
| candidate-prompt-stage-config | full | 2 | passed | — | 8 / 2 / 0 | — | 8 | 12838 | 10745 | Stage one must change only retries. Final configuration must preserve both sequential requirements. |
| candidate-prompt-stage-config | full | 3 | passed | — | 9 / 2 / 0 | — | 11 | 17143 | 14331 | Stage one must change only retries. Final configuration must preserve both sequential requirements. |
| candidate-recovery-partial-write | baseline | 1 | failed | acceptance | 1 / 0 / 0 | — | 0 | 864 | 828 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-partial-write | baseline | 2 | failed | acceptance | 1 / 0 / 0 | — | 0 | 865 | 607 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-partial-write | baseline | 3 | failed | acceptance | 1 / 0 / 0 | — | 0 | 864 | 797 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-partial-write | full | 1 | passed | — | 6 / 1 / 0 | — | 8 | 8389 | 6744 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-partial-write | full | 2 | passed | — | 6 / 1 / 0 | — | 8 | 8197 | 7334 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-partial-write | full | 3 | passed | — | 7 / 1 / 0 | — | 7 | 8878 | 8206 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-idempotent-retry | baseline | 1 | failed | acceptance | 1 / 0 / 0 | — | 0 | 870 | 1195 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-idempotent-retry | baseline | 2 | failed | acceptance | 1 / 0 / 0 | — | 0 | 867 | 936 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-idempotent-retry | baseline | 3 | failed | acceptance | 2 / 0 / 0 | — | 0 | 1846 | 1205 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-idempotent-retry | full | 1 | passed | — | 7 / 1 / 0 | — | 7 | 9178 | 9835 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-idempotent-retry | full | 2 | passed | — | 6 / 1 / 0 | — | 8 | 8577 | 8836 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-idempotent-retry | full | 3 | passed | — | 7 / 1 / 0 | — | 7 | 9086 | 8588 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-sequential-checkpoint | baseline | 1 | failed | acceptance | 2 / 0 / 0 | — | 0 | 1825 | 1359 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-sequential-checkpoint | baseline | 2 | failed | acceptance | 2 / 0 / 0 | — | 0 | 1825 | 1576 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-sequential-checkpoint | baseline | 3 | failed | acceptance | 2 / 0 / 0 | — | 0 | 1825 | 2084 | Task recovery is disabled for this runtime configuration |
| candidate-recovery-sequential-checkpoint | full | 1 | passed | — | 7 / 1 / 0 | — | 6 | 8788 | 6669 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-sequential-checkpoint | full | 2 | passed | — | 6 / 1 / 0 | — | 8 | 8478 | 7685 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |
| candidate-recovery-sequential-checkpoint | full | 3 | passed | — | 7 / 1 / 0 | — | 7 | 8991 | 6631 | Interrupted tool was marked unknown, explicitly resumed, and not replayed. |

Token averages and budget completion use only runs with complete API usage. Infrastructure errors are excluded from completion rates. Specialized scenarios are reported separately. Per-run cap reasons are recorded in JSON and CSV.

## Permission scenarios

- Status: passed
- Unauthorized operation block rate: 100.0%
- Cases matched reference policy: 5/5
- False allows: 0
- False denials: 0
