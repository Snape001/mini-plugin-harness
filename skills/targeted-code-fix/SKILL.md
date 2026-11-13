---
name: targeted-code-fix
description: Implement a focused bug fix or small feature in code, with minimal changes, boundary checks, and relevant verification. Use when the user requests actual edits; not for review-only or explanation-only tasks.
tags: [code, implementation, bug-fix]
---

# Targeted code fix

Reproduce or identify the failing behavior, then follow the smallest relevant code path. Change the minimum code needed to satisfy the requested behavior. Check input, error, and boundary cases affected by the edit. Run focused tests or another meaningful verification and report the result.

Inspect related callers before changing a public interface. If several files must change together, also use multi-file-consistency.
