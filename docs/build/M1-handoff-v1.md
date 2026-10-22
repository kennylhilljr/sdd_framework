---
title: "M1 handoff: TECH revocation"
type: handoff
version: 1
status: approved
owner: "Avery Chen (product owner)"
milestone: M1
---

# M1 handoff: TECH revocation (v1)

> **Owner:** A · **Persona:** `implementer` wrote it; `verifier` checked it independently.

## What shipped

`authorize` (TECH-1) and `revokeRole` (TECH-2, TECH-3, TECH-4) in `src/tech/`, following [LLD-tech §2 and §3](../lld/LLD-tech-v1.md).

## Evidence

| Command | Result |
| --- | --- |
| `npm run typecheck` | No errors |
| `npm test` | All TECH tests pass, one per criterion |
| `node tools/spec-lint/spec-lint.mjs` | 0 errors |
| `node tools/trace-check/trace-check.mjs` | 0 errors; TECH-5 deferred (P3) |

## Verifier notes

The differential audit of TECH-2 ([audit record](../trace/audits/tech/TECH-2.md)) found one documentation-only gap: the invalidation order lives in the LLD, not in the criterion. No code change was needed.

## Follow-ups

- Integration test that pins invalidation after commit (LLD-tech §3), planned for M2.
- TECH-5 bulk revocation, revisit at the M2 kickoff.
