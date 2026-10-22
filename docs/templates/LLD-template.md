---
title: "{{TITLE}}"
type: lld
version: {{VERSION}}
status: draft
owner: "[Name]"
prefix: {{PREFIX}}
component: {{COMPONENT}}
parent: docs/spec/SPEC-v1.md
date: {{DATE}}
---

# LLD: {{TITLE}} (v{{VERSION}})

## How to use this template

*One LLD per component. Almost entirely agent-written; humans review only what is costly to reverse: public contracts, persisted schema and authorization. Approved at Gate 3. Link back to the SPEC section and the requirement IDs this component satisfies. Rationale inferred from existing code is tagged `[inferred]` until the owner confirms it.*

## 1. Scope and requirements

> **Owner:** A · **Persona:** `component-designer`

| Requirement | Criteria | SPEC section |
| --- | --- | --- |
| [PREFIX]-FR-1 | [PREFIX]-1 | SPEC 4 |

## 2. Contracts

> **Owner:** A · **Persona:** `component-designer` · **Human review:** yes for any public or cross-team contract

*Link the machine-readable contract in `docs/contracts/`.*

## 3. Data model, schema and migrations

> **Owner:** A · **Persona:** `component-designer` · **Human review:** yes for anything persisted

## 4. Authentication and authorization enforcement points

> **Owner:** A · **Persona:** `security-reviewer` · **Human review:** always

## 5. Module structure, interfaces and algorithms

> **Owner:** A · **Persona:** `component-designer`

## 6. Error handling, retries and idempotency

> **Owner:** A · **Persona:** `component-designer`

## 7. Configuration and feature flags

> **Owner:** A · **Persona:** `component-designer`

| Flag | Default | Safe to switch off? |
| --- | --- | --- |
| | off | |

## 8. Observability

> **Owner:** A · **Persona:** `sre`

*Metrics, logs and alerts. Thresholds trace to NFR IDs.*

## 9. Test plan for this component

> **Owner:** A · **Persona:** `test-architect`

*Which tests cover which criteria. The coverage report itself is generated in `docs/trace/coverage.md` by trace-check.*

## 10. Decisions and alternatives

> **Owner:** A · **Persona:** `component-designer`

| Decision | Rationale | Alternatives considered |
| --- | --- | --- |
| | | |

## 11. Open questions

> **Owner:** A · **Persona:** `component-designer`

- [ ] Q:

### Gate 3: Detailed design reviewed

| Reviewer | Date | Contracts | Schema | AuthZ | Notes |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
