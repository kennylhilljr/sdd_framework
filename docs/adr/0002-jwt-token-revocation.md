---
title: "Tokens carry identity only; grants come from a cache invalidated on revocation"
status: accepted
owner: "Riley Park (architect)"
date: 2026-02-24
---

# ADR 0002: Tokens carry identity only; grants come from a cache invalidated on revocation

> **Owner:** C · **Persona:** `architect` drafted the options; `security-reviewer` reviewed; the owner decided at Gate 2.

## Context

OUT-2 and IAM-2 require a revoked role to stop granting access within 60 seconds. NFR-1 requires access checks under 50 ms at p99. The [token storage research](../research/iam-token-storage-v1.md) compared four ways to combine signed tokens (JWT) and stored grants.

## Options

| Option | Benefits | Costs |
| --- | --- | --- |
| 1. JWT with grants inside, long expiry | Fastest checks; no lookup | Revocation waits for expiry; fails IAM-2 |
| 2. Short-lived JWT with grants, 5-minute expiry | Simple | Revocation lag up to 5 minutes; fails IAM-2 |
| 3. JWT with identity only; grants from a cache that revocation invalidates; 30-second time-to-live as a safety net | Meets IAM-2 and NFR-1; lost invalidations still expire in 30 seconds | One more moving part (the cache) to run and monitor |
| 4. Read grants from the database on every check | Always current | Fails NFR-1 at peak load |

## Decision

Option 3. Tokens identify the caller only. The authorization service reads grants from a grant cache. A revocation deletes the user's cache entry in the same request, and every entry expires after 30 seconds in case an invalidation is lost.

## Consequences

- A lost invalidation is bounded by the 30-second time-to-live, inside the 60-second limit of IAM-2.
- Cache hit rate and invalidation failures need metrics and alerts (LLD-iam §6).
- If the cache is down, checks fall back to the database and are slower; this is an S2 condition, not an outage.
