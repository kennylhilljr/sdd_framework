# Glossary

Domain terms used across this project's documents, defined once. Terms used only inside one PRD stay in that PRD's glossary section.

> **Owner:** A · **Persona:** `product-writer` (definitions), `doc-steward` (hygiene)

## Framework terms

| Term | Definition |
| --- | --- |
| Acceptance criterion | A testable statement of behavior in EARS notation, with an ID such as `IAM-2`. Tests and code cite it with `@spec`. |
| ADR | Architecture decision record: one decision with its options and tradeoffs. Superseded by a new ADR, never edited after acceptance. |
| Annotation reach | The share of changed source files that carry at least one `@spec` annotation. |
| EARS | Easy Approach to Requirements Syntax: fixed sentence shapes such as "When *trigger*, the *system* shall *response*." |
| Gate | A human approval point: Gate 1 approves the PRD, Gate 2 the SPEC, Gate 3 the LLD. |
| Persona | A named role an agent plays when it writes or reviews part of a document. |
| Reverse orphan | An `@spec` annotation that cites an ID no document defines. |
| Severity (S0 to S4) | The urgency and impact of support work, from S0 (critical, immediate) to S4 (negligible, backlog). |

## Domain terms (worked example)

| Term | Definition |
| --- | --- |
| Access check | A call that answers whether a user may perform an action. |
| Audit record | An append-only entry recording who changed access, for whom, and when. |
| Grant | Permission for one action, given by a role. |
| Grant cache | A short-lived copy of a user's grants used to answer access checks quickly. |
| Revocation | Removing a role from a user. |
| Role | A named set of grants assigned to users. |
| Usage count | The number of access checks a team made on one day, used for internal billing. |
