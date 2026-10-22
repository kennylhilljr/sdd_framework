---
title: "Research: where to keep grants and how to revoke them fast"
type: research
version: 1
status: approved
owner: "Riley Park (architect)"
---

# Research: where to keep grants and how to revoke them fast (v1)

> **Owner:** A · **Persona:** `analyst`. Prior art and a short spike that inform the PRD and ADR 0002.

## Question

Access checks must be fast (NFR-1, p99 under 50 ms) but a revoked role must stop working within 60 seconds (OUT-2). Where should grants live, and how should a revocation reach every place that caches them?

## Options studied

| Option | How revocation propagates | Read latency | Notes |
| --- | --- | --- | --- |
| Self-contained signed tokens (JWT) with long expiry | Not at all until the token expires | Lowest; no lookup | Revocation lag equals token lifetime |
| Short-lived JWTs (5 minutes) plus a refresh call | At the next refresh | Low | Lag up to 5 minutes; refresh traffic grows with users |
| JWT carrying only identity, grants looked up in a cache | Cache entry deleted on revocation | Low with a warm cache | Needs a cache invalidation path |
| Every check reads the database | Immediate | Highest; database on the hot path | Simple, but fails NFR-1 at peak load |

## Spike

A two-day spike measured a cached grant lookup at 3 ms p99 and a database read at 41 ms p99 under the expected peak of 2,000 checks per second. Deleting a cache entry on revocation made the change visible to the next check in under 10 ms.

## Findings

1. Signed tokens should carry identity only; putting grants in the token makes fast revocation impossible.
2. A grant cache with explicit invalidation on revocation meets both NFR-1 and OUT-2.
3. A time-to-live on cache entries is still needed as a safety net if an invalidation message is lost.

## Sources

- Internal spike notes, February 2026 (example).
- Public guidance on token revocation patterns in the OAuth 2.0 and JWT specifications.
