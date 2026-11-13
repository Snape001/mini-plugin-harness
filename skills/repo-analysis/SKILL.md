---
name: repo-analysis
description: Map a repository's structure and explain how its components, data flow, and key functions fit together. Use when a user asks to understand a project, locate an implementation, or summarize architecture.
tags:
  - repository
  - architecture
  - code
---

# Repository analysis

Start with a bounded file listing, then inspect manifests, entry points, and the requested implementation. Trace important calls or data flow across files instead of describing folders in isolation.

Summarize the repository structure, identify the relevant files and functions, and explain how they work together. Support claims with file paths and line numbers where available. Be explicit about anything you could not verify from the files you inspected.
