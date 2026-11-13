---
name: code-review
description: Review existing source code for correctness, security, maintainability, and likely regressions. Use when a user asks to review code, inspect a function, or assess implementation quality.
tags:
  - code
  - review
  - security
---

# Code review

Inspect the relevant implementation and its callers before drawing conclusions. Use repository tools to read the actual files and cite paths and line numbers when possible.

Prioritize concrete defects, unsafe behavior, broken edge cases, and regressions. Explain the impact and conditions that trigger each finding. Separate verified findings from questions or suggestions. If no actionable issue is found, say so and mention any important coverage gaps.

Do not modify files. Do not infer behavior from names alone; follow the implementation and relevant tests.
