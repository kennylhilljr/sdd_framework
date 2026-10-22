---
title: "Use PostgreSQL as the system of record"
status: accepted
owner: "Riley Park (architect)"
date: 2026-02-20
---

# ADR 0001: Use PostgreSQL as the system of record

> **Owner:** C · **Persona:** `architect` drafted the options; the owner decided at Gate 2.

## Context

The access platform stores roles, grants and an append-only audit log that must be kept for seven years (NFR-4) in the primary region (NFR-3). Revocations must be transactional: the role is removed and the audit record is written together, or neither happens (INV-2).

## Options

| Option | Benefits | Costs |
| --- | --- | --- |
| 1. Managed PostgreSQL | Already approved in the constitution; transactions cover the role change and the audit record; the operations team runs it today | Needs a cache in front of it to meet NFR-1 at peak |
| 2. A key-value store | Very fast reads | No multi-row transactions; audit integrity would need extra machinery |
| 3. A document database | Flexible schema | Not on the approved stack; new operational skills needed |

## Decision

Use managed PostgreSQL (option 1) for roles, grants and the audit log, with a grant cache in front of it for access checks (see ADR 0002).

## Consequences

- Revocation and its audit record commit in one transaction.
- Access checks must not read PostgreSQL on the hot path at peak load; the grant cache carries that load.
- Failover follows the [database failover runbook](../runbooks/db-failover-v1.md).
