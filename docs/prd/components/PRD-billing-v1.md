---
title: "Billing: usage metering and internal invoices"
type: prd-component
version: 1
status: draft
owner: "Jordan Ellis (finance lead)"
prefix: BILL
parent: docs/prd/PRD-v1.md
---

# Component PRD: billing (v1, draft)

> Requirement IDs in this document start with `BILL-`. This PRD is a draft: its criteria are not enforced by trace-check until it is approved at Gate 1.

## Problem

> **Owner:** H

Teams that call the access check heavily do not pay for the capacity they use. Finance wants a monthly internal invoice per team, based on metered usage.

## User stories and priority

> **Owner:** C for stories (`product-writer`), H for priority

| ID | Story | Priority | Why this priority |
| --- | --- | --- | --- |
| BILL-US-1 | As a finance analyst, I want access checks counted per calling team, so that usage can be charged back. | P2 | Needed before chargeback starts |
| BILL-US-2 | As a team lead, I want a monthly invoice with my team's usage, so that I can plan my budget. | P2 | Same release as metering |

## Functional requirements

> **Owner:** A · **Persona:** `product-writer`

| ID | Requirement | Story | Parent |
| --- | --- | --- | --- |
| BILL-FR-1 | Count access checks per calling team | BILL-US-1 | FR-4 |
| BILL-FR-2 | Produce a monthly invoice per team | BILL-US-2 | FR-5 |

## Acceptance criteria

> **Owner:** A · **Persona:** `product-writer`

| ID | Criterion | Requirement | Priority |
| --- | --- | --- | --- |
| BILL-1 | When the authorization service answers an access check, the metering service shall add one to the calling team's count for that day. | BILL-FR-1 | P2 |
| BILL-2 | When a calendar month closes, the billing service shall produce one invoice per team with that month's usage. | BILL-FR-2 | P2 |
| BILL-3 | If a team has no usage in a month, then the billing service shall produce no invoice for that team. | BILL-FR-2 | P2 |

## Assumptions and open questions

> **Owner:** A · **Persona:** `product-writer` surfaces; the owner resolves

- [ ] Q: What is the price per thousand access checks, and who sets it?
- [ ] Q: Are failed access checks (errors, not denials) billable?
- [x] Q: Which time zone closes the month? Resolved: UTC.
