---
title: "Access platform: parent PRD"
type: prd
version: 1
status: approved
owner: "Avery Chen (product owner)"
approved: 2026-02-16
components: [tech, billing]
---

# Access platform: parent PRD (v1)

> Parent PRD for the worked example. Component PRDs: [TECH](components/PRD-tech-v1.md) and [billing](components/PRD-billing-v1.md). Vision: [vision-v1](../vision/vision-v1.md).

## 1.1 Problem and why now

> **Owner:** H · **Persona:** none (`analyst` interviewed the owner)

Product teams each run their own permission checks. Revoked roles keep working for hours in some products, and audits take weeks because there is no single record of who could do what. Two audit findings in the last year named slow revocation, and the next audit is in six months.

## 1.2 Customers and users

> **Owner:** H

| User or stakeholder | Need | Relative size |
| --- | --- | --- |
| Product engineers | One call to check access, fast enough for every request | About 40 teams |
| Security administrators | Revocation that takes effect everywhere within a minute | 6 people |
| Auditors | A complete, queryable record of grants and revocations | Quarterly use |
| Finance | Usage numbers per team for internal billing | Monthly use |

## 1.3 Scope and non-goals

> **Owner:** H

**In scope:** roles, grants, access checks, revocation, audit log, usage metering and internal invoices.

| Non-goal | Why it is excluded |
| --- | --- |
| Sign-in and passwords | Owned by the identity provider |
| Per-record policy rules | Roles cover the known use cases for two years |
| External customer billing | Internal chargeback only |

## 1.4 Measurable outcomes

> **Owner:** H

| ID | Metric | Baseline | Target | By when |
| --- | --- | --- | --- | --- |
| OUT-1 | Products checking access through the platform | 0 of 40 | 30 of 40 | 2026-12-31 |
| OUT-2 | Time from revocation to denied access (p99) | Up to 24 hours | 60 seconds | 2026-06-30 |
| OUT-3 | Time to answer an auditor's "who could do X on date Y" | About 3 weeks | 1 day | 2026-09-30 |

## 1.7 Invariants: what must never happen

> **Owner:** H

| ID | The system must never | Source |
| --- | --- | --- |
| INV-1 | Grant access after the role behind it was revoked and the 60-second window has passed | Security policy SP-12 (example) |
| INV-2 | Lose or alter an audit record | Audit retention policy (example) |
| INV-3 | Allow an access check without an authenticated caller | Security policy SP-3 (example) |

## 1.8 Known constraints

> **Owner:** H

- Runs on the company's managed PostgreSQL and container platform (see the constitution).
- First production release by 2026-06-30, before the next audit.

## 1.9 Decisions already made and still open

> **Owner:** H

| Decision | Status | Rationale or link |
| --- | --- | --- |
| Use PostgreSQL as the system of record | Made | [ADR 0001](../adr/0001-use-postgresql.md) |
| How tokens and revocation work together | Made | [ADR 0002](../adr/0002-jwt-token-revocation.md) |

## Functional requirement index

> **Owner:** H

| ID | Requirement | Component |
| --- | --- | --- |
| FR-1 | Answer whether a user may perform an action | TECH |
| FR-2 | Grant and revoke roles, with revocation taking effect within 60 seconds | TECH |
| FR-3 | Record every grant and revocation in an audit log | TECH |
| FR-4 | Meter access checks per calling team | Billing |
| FR-5 | Produce a monthly internal invoice per team | Billing |

## Non-functional requirements

> **Owner:** H for targets; `product-writer` made them testable

| ID | Quality | Target | How it is measured |
| --- | --- | --- | --- |
| NFR-1 | Latency | Access check p99 under 50 ms at 2,000 checks per second | Load test before each release |
| NFR-2 | Availability | 99.95% monthly for access checks | Service level dashboard |
| NFR-3 | Data residency | All data stored in the company's primary region | Deployment review at Gate 2 |
| NFR-4 | Audit retention | Seven years, append only | Storage policy check |

## 2.9 Rollout risk tolerance and support

> **Owner:** H

| Question | Answer |
| --- | --- |
| Rollout appetite | Internal pilot with 3 teams, then 25%, then all teams |
| Halt conditions | Any S0, or access check errors above 0.1% for 10 minutes |
| Support owner | Platform on-call rotation, escalation to Riley Park |
| Response targets | S0 immediate, S1 same day, S2 within the sprint, S3 and S4 backlog |

## 2.11 Definition of done

> **Owner:** H

The TECH release is done when every P1 TECH criterion has a passing test, the load test meets NFR-1, OUT-2 is measurable on the dashboard, and the pilot teams have run for two weeks without an S0 or S1.
