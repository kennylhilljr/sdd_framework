---
title: "M1 plan: TECH revocation"
type: plan
version: 1
status: approved
owner: "Avery Chen (product owner)"
milestone: M1
---

# M1 plan: TECH revocation (v1)

> **Owner:** A · **Persona:** `planner`. Each task fits one agent session and cites the criteria it delivers. Tests are written before code.

| Task | Delivers | Depends on | Files | Done when |
| --- | --- | --- | --- | --- |
| M1-1 In-memory role store, grant cache and audit log | Supports TECH-1 to TECH-4 | | `src/tech/revoke-role.ts` | Types compile; no behavior yet |
| M1-2 Access check | TECH-1 | M1-1 | `src/tech/authorize.ts`, `test/tech/revoke-role.test.ts` | TECH-1 test passes |
| M1-3 Revocation with cache invalidation | TECH-2 | M1-1, M1-2 | `src/tech/revoke-role.ts` | TECH-2 test passes |
| M1-4 Unknown user rejection | TECH-3 | M1-3 | same | TECH-3 test passes |
| M1-5 Audit record on revocation | TECH-4 | M1-3 | same | TECH-4 test passes |
| M1-6 Verify and hand off | All of the above | M1-2 to M1-5 | `docs/build/M1-handoff-v1.md` | `node tools/sdd/cli.mjs check` passes; verifier audit recorded |
