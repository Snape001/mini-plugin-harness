---
name: bug-investigation
description: Diagnose a reported error, regression, or incorrect behavior and identify its cause without changing code. Use when the requested outcome is an explanation; for an actual fix, use targeted-code-fix.
tags: [debugging, diagnosis, root-cause]
---

# Bug investigation

Translate the report into observable symptoms. Trace the affected entry point, callers, error handling, and relevant tests. Reproduce the problem when practical. Separate confirmed causes from hypotheses and explain triggering conditions.

Recommend a focused correction, but do not claim a fix unless code was changed. When the user requests implementation, use targeted-code-fix.
