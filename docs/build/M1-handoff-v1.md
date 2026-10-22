---
title: "M1 handoff: IAM revocation"
type: handoff
version: 1
status: approved
owner: "Avery Chen (product owner)"
milestone: M1
---

# M1 handoff: IAM revocation (v1)

> **Owner:** A · **Persona:** `implementer` wrote it; `verifier` checked it independently.

## What shipped

`authorize` (IAM-1) and `revokeRole` (IAM-2, IAM-3, IAM-4) in `src/iam/`, following [LLD-iam §2 and §3](../lld/LLD-iam-v1.md).

## Evidence

| Command | Result |
| --- | --- |
| `npm run typecheck` | No errors |
| `npm test` | All IAM tests pass, one per criterion |
| `node tools/spec-lint/spec-lint.mjs` | 0 errors |
| `node tools/trace-check/trace-check.mjs` | 0 errors; IAM-5 deferred (P3) |

## Verifier notes

The differential audit of IAM-2 ([audit record](../trace/audits/iam/IAM-2.md)) found one documentation-only gap: the invalidation order lives in the LLD, not in the criterion. No code change was needed.

## Follow-ups

- Integration test that pins invalidation after commit (LLD-iam §3), planned for M2.
- IAM-5 bulk revocation, revisit at the M2 kickoff.
