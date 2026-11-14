---
name: safe-release
description: Audit and repair a release manifest using the safe-release policy. Use when a release channel or rollback plan must be validated before shipping.
tags: [release, policy, audit, safety]
---

# Safe release audit

Apply this policy exactly. Do not infer a different policy from the repository. This skill content is the complete policy; do not search the workspace for another copy or for a `SKILL.md` file.

- Allowed release channels are `stable` and `beta`. Any other channel is blocked.
- A blocked release must be recorded with the marker `POLICY-SR-7` and the word `BLOCKED` in `audit.md`.
- The manifest must keep a non-empty `rollbackPlan` before the release can proceed.
- Keep the acceptance artifact outside `src/` and outside the release manifest.

When repairing the manifest, preserve the original JSON keys and write valid JSON.
