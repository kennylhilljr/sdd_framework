---
title: "M1 kickoff: IAM revocation"
type: kickoff
version: 1
status: approved
owner: "Avery Chen (product owner)"
milestone: M1
---

# M1 kickoff: IAM revocation (v1)

> **Owner:** C · **Persona:** `planner` drafted; the owner confirmed scope.

## Goal

Ship the access check and fast revocation so that OUT-2 (60-second revocation) is measurable before the audit.

## In scope

IAM-1, IAM-2, IAM-3, IAM-4 (all P1). Design: [LLD-iam-v1](../lld/LLD-iam-v1.md).

## Out of scope

IAM-5 (bulk revocation, P3, deferred) and all billing work (PRD-billing is still a draft).

## Exit criteria

- Every in-scope criterion has a passing test that cites it with `@spec`.
- `node tools/sdd/cli.mjs check` passes.
- The `verifier` has audited the IAM component and recorded it in `docs/trace/index.yaml`.
