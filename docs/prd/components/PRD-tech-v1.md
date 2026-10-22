---
title: "TECH: roles, access checks and revocation"
type: prd-component
version: 1
status: approved
owner: "Avery Chen (product owner)"
prefix: TECH
parent: docs/prd/PRD-v1.md
approved: 2026-02-16
---

# Component PRD: TECH (v1)

> Requirement IDs in this document start with `TECH-`. Parent: [PRD-v1](../PRD-v1.md). Design: [SPEC 4.2](../../spec/SPEC-v1.md) and [LLD-tech §3](../../lld/LLD-tech-v1.md).

## Problem

> **Owner:** H

Product teams need one fast call to check access, and security needs revocation to take effect within a minute everywhere. Today each product caches roles on its own, so a revoked role can keep working for hours.

## User stories and priority

> **Owner:** C for stories (`product-writer`), H for priority

| ID | Story | Priority | Why this priority |
| --- | --- | --- | --- |
| TECH-US-1 | As a product engineer, I want to ask whether a user may perform an action, so that I do not build my own permission checks. | P1 | Nothing else works without the access check |
| TECH-US-2 | As a security administrator, I want a revoked role to stop working within a minute, so that people who leave a team lose access quickly. | P1 | Named in two audit findings |
| TECH-US-3 | As an auditor, I want every revocation recorded with who did it and when, so that I can answer access questions from the record. | P1 | Required for the next audit |
| TECH-US-4 | As a security administrator, I want to revoke a role from everyone at once, so that I can retire a role in one step. | P3 | Rare; can be done one user at a time for now |

## Functional requirements

> **Owner:** A · **Persona:** `product-writer`

| ID | Requirement | Story | Parent |
| --- | --- | --- | --- |
| TECH-FR-1 | Decide access from the roles a user holds | TECH-US-1 | FR-1 |
| TECH-FR-2 | Revoke a role from a user and invalidate cached grants | TECH-US-2 | FR-2 |
| TECH-FR-3 | Record revocations in the audit log | TECH-US-3 | FR-3 |
| TECH-FR-4 | Revoke a role from all users in one request | TECH-US-4 | FR-2 |

## Acceptance criteria

> **Owner:** A · **Persona:** `product-writer`. EARS notation; one response per criterion. Criteria inherit their story's priority.

| ID | Criterion | Requirement | Priority |
| --- | --- | --- | --- |
| TECH-1 | When a user requests an action, the authorization service shall allow it only if one of the user's current roles grants that action. | TECH-FR-1 | P1 |
| TECH-2 | When a user's role is revoked, the authorization service shall invalidate that user's cached grants within 60 seconds. | TECH-FR-2 | P1 |
| TECH-3 | If a revocation names a user that does not exist, then the authorization service shall reject the request with a not-found error. | TECH-FR-2 | P1 |
| TECH-4 | The authorization service shall record every revocation in the audit log with the actor, user, role and time. | TECH-FR-3 | P1 |
| TECH-5 | Where bulk revocation is enabled, the authorization service shall revoke a role from all users that hold it in one request. | TECH-FR-4 | P3 |

## Invariants

> **Owner:** H

| ID | The system must never | Source |
| --- | --- | --- |
| TECH-INV-1 | Serve a cached grant for a role that was revoked more than 60 seconds ago | INV-1 |

## Non-functional requirements

> **Owner:** H for targets

| ID | Quality | Target | How it is measured |
| --- | --- | --- | --- |
| TECH-NFR-1 | Access check latency | p99 under 50 ms at 2,000 checks per second | Load test (NFR-1) |

## Edge cases and error behavior

> **Owner:** A · **Persona:** `product-writer`

- Revoking a role the user does not hold succeeds and is still audited, so retries are safe.
- An access check for an unknown user is denied, not an error.
- If the cache is unreachable, access checks read the role store directly and log a warning.

## Data and classification

> **Owner:** H

| Data | Classification | Source or owner | Retention | Notes |
| --- | --- | --- | --- | --- |
| User IDs and role names | Internal | Identity provider and TECH | Life of the account | No personal data beyond the ID |
| Audit records | Confidential | TECH | Seven years | Append only (INV-2) |

## Assumptions and open questions

> **Owner:** A · **Persona:** `product-writer` surfaces; the owner resolves

- [x] Q: Is 60 seconds measured from the revocation request or from its commit? Resolved: from the commit.
- [x] Q: Should revoking a role the user does not hold fail? Resolved: no; it succeeds and is audited.

## Glossary

> **Owner:** A · **Persona:** `product-writer`

| Term | Definition |
| --- | --- |
| Grant | Permission for one action, given by a role |
| Revocation | Removing a role from a user |
| Grant cache | A short-lived copy of a user's grants used to answer access checks quickly |
