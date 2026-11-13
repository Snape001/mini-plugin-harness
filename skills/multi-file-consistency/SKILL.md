---
name: multi-file-consistency
description: Keep related code, interfaces, callers, configuration, and tests consistent during a change that spans multiple files. Use for cross-file implementation work; not for a one-file fix or review-only task.
tags: [code, interfaces, cross-file]
---

# Multi-file consistency

Trace the changed value or interface from definition through callers, adapters, configuration, and tests. Identify every affected file before editing. Update related uses together and check that defaults, types, validation, and error behavior agree. Verify the end-to-end path and report any intentionally unsupported caller.

Use targeted-code-fix for the actual correction when appropriate. Avoid broad unrelated cleanup.
