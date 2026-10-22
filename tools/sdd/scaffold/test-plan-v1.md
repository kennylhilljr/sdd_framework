---
title: "Test plan"
type: test-plan
version: 1
status: draft
owner: "[Name]"
deferred: []
---

# Test plan (v1)

> **Owner:** A · **Persona:** `test-architect`. Coverage is derived status, so it is not kept here: `node tools/trace-check/trace-check.mjs --write` regenerates [docs/trace/coverage.md](../trace/coverage.md) from the `@spec` annotations. Deferring a criterion needs the owner's approval, and only P2 and P3 criteria may be deferred: list them in `deferred:` in the front matter.

## Strategy

> **Owner:** A · **Persona:** `test-architect`

Which test layers exist (unit, integration, end to end), the tools, and what each layer covers.

## Deferred criteria

> **Owner:** H decides; `test-architect` records

| ID | Priority | Why it is deferred | Revisit by |
| --- | --- | --- | --- |
