---
title: "Test plan"
type: test-plan
version: 1
status: approved
owner: "Morgan Lee (QA lead)"
deferred: [IAM-5]
approved: 2026-03-02
---

# Test plan (v1)

> **Owner:** A · **Persona:** `test-architect`. Coverage is derived status, so it is not kept in this approved document: `node tools/trace-check/trace-check.mjs --write` regenerates [docs/trace/coverage.md](../trace/coverage.md) from the `@spec` annotations. Deferring a criterion needs the owner's approval, and only P2 and P3 criteria may be deferred: they are listed in `deferred:` in the front matter.

## Strategy

> **Owner:** A · **Persona:** `test-architect`

| Layer | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest | Every IAM acceptance criterion, with in-memory stores and a fake clock |
| Integration | Vitest against a local PostgreSQL and cache | Revocation transaction and invalidation order (LLD-iam §3) |
| Load | Load test before each release | NFR-1 and IAM-NFR-1 |

Each unit test names its criterion ID in the title and carries `// @spec <ID>`.

## Deferred criteria

> **Owner:** H decides; `test-architect` records

| ID | Priority | Reason | Revisit |
| --- | --- | --- | --- |
| IAM-5 | P3 | Bulk revocation is behind a flag that stays off for M1 | M2 kickoff |
