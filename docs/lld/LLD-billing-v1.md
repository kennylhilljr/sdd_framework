---
title: "Billing low-level design"
type: lld
version: 1
status: draft
owner: "Riley Park (architect)"
prefix: BILL
parent: docs/spec/SPEC-v1.md
---

# LLD: billing (v1, draft)

> Draft. Waits for [PRD-billing-v1](../prd/components/PRD-billing-v1.md) to pass Gate 1.

## §1 Usage events

> **Owner:** A · **Persona:** `component-designer`

Each access check emits `{ team, at }`. The metering job adds them to `usage_count(team, day, checks)` (BILL-1).

## §2 Monthly invoices

> **Owner:** A · **Persona:** `component-designer`

On the first day of each month (UTC) a job sums the previous month per team and writes one invoice per team with usage (BILL-2, BILL-3).

## §3 Open questions

- [ ] Q: Price per thousand checks (blocks the invoice format).
