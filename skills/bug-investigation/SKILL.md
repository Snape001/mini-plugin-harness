---
name: bug-investigation
description: Investigate a reported defect by tracing the affected code path, identifying plausible causes, and checking available tests or related code. Use when a user reports incorrect behavior, an error, or a regression.
tags:
  - debugging
  - bug
  - investigation
---

# Bug investigation

Translate the report into observable symptoms and identify the relevant entry point. Search for the error text, affected symbols, and callers, then read enough surrounding code to follow the failing path.

Distinguish confirmed causes from hypotheses. Use existing tests and nearby validation logic as evidence. Report the likely cause, the conditions that trigger it, and a focused next step or fix direction. Do not claim a fix was applied unless files were actually changed.
