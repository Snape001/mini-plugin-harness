---
name: repo-analysis
description: Locate code and explain repository structure, component responsibilities, or data flow. Use for understanding and navigation requests; not for defect review or code changes.
tags: [repository, architecture, navigation]
---

# Repository analysis

Start with a bounded file listing. Read manifests, entry points, and the relevant implementation, then trace calls and data flow across files. Explain the requested behavior with paths and line numbers when available. State what remains unverified.

For a reported defect, use bug-investigation; for a requested edit, use targeted-code-fix or multi-file-consistency.
