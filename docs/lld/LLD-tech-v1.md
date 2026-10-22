---
title: "TECH low-level design"
type: lld
version: 1
status: approved
owner: "Riley Park (architect)"
prefix: TECH
parent: docs/spec/SPEC-v1.md
approved: 2026-03-02
---

# LLD: TECH (v1)

> Implements [SPEC 4.1 and 4.2](../spec/SPEC-v1.md) and the criteria in [PRD-tech-v1](../prd/components/PRD-tech-v1.md). Code: `src/tech/`. Tests: `test/tech/`.

## §1 Contracts

> **Owner:** A · **Persona:** `component-designer`. Reviewed by the owner at Gate 3 (public contract).

The REST contract is [docs/contracts/openapi.yaml](../contracts/openapi.yaml). The revocation event is [session-event.schema.json](../contracts/session-event.schema.json). Agent tool definitions are in [agent-tools.json](../contracts/agent-tools.json).

| Operation | Path | Criteria |
| --- | --- | --- |
| Check access | `GET /v1/authorize?userId=&action=` | TECH-1 |
| Grant a role | `POST /v1/users/{userId}/roles` | |
| Revoke a role | `DELETE /v1/users/{userId}/roles/{role}` | TECH-2, TECH-3, TECH-4 |

## §2 Access check

> **Owner:** A · **Persona:** `component-designer`

`authorize(userId, action)` reads the user's grants from the grant cache. On a miss it reads the user's roles from the role store, expands them to actions, stores the result with a 30-second time-to-live and answers. Unknown users are denied. Entry point: `src/tech/authorize.ts`.

## §3 Revocation and cache invalidation

> **Owner:** A · **Persona:** `component-designer`

`revokeRole(userId, role, actor)`:

1. If the user does not exist, throw `NotFoundError` (TECH-3). Nothing is changed or audited.
2. Remove the role assignment and append the audit record `{ actor, userId, role, action: "revoke", at }` in one transaction (TECH-4, INV-2).
3. After the commit, delete the user's grant-cache entry (TECH-2). The next check reads current grants.
4. If the cache delete fails, log `tech.cache_invalidation_failed` and return success; the 30-second time-to-live still bounds staleness inside the 60-second limit.

Entry point: `src/tech/revoke-role.ts`.

## §4 Persisted schema

> **Owner:** A · **Persona:** `component-designer`. Reviewed by the owner at Gate 3 (persisted data).

```sql
create table role_assignment (user_id text not null, role text not null, granted_at timestamptz not null, primary key (user_id, role));
create table audit_record (id bigserial primary key, actor text not null, user_id text not null, role text not null, action text not null, at timestamptz not null);
revoke update, delete on audit_record from tech_service;
```

## §5 Errors and configuration

> **Owner:** A · **Persona:** `component-designer`

| Error | HTTP | When |
| --- | --- | --- |
| `NotFoundError` | 404 | Revocation names an unknown user (TECH-3) |
| `UnauthenticatedError` | 401 | Missing or invalid token (INV-3) |

| Setting or flag | Default | Notes |
| --- | --- | --- |
| `TECH_GRANT_CACHE_TTL_SECONDS` | 30 | Must stay under 60 (TECH-2) |
| `tech.bulkRevocation` feature flag | off | TECH-5, deferred to a later milestone |

## §6 Observability

> **Owner:** A · **Persona:** `sre`

| Signal | Type | Alert |
| --- | --- | --- |
| `tech.authorize.latency` | Histogram | p99 over 50 ms for 10 minutes (NFR-1) |
| `tech.cache.hit_ratio` | Gauge | Under 80% for 30 minutes |
| `tech.cache_invalidation_failed` | Counter | Any occurrence pages the on-call (S1) |

## §7 Security

> **Owner:** A · **Persona:** `security-reviewer`. Always reviewed by the owner.

Only callers holding `access-admin` may revoke. The service's database user cannot update or delete audit records. Tokens are validated on every request before any lookup.

## §8 Test plan

> **Owner:** A · **Persona:** `test-architect`

Criterion-to-test coverage is generated in the [test plan](../test/test-plan-v1.md).

## §9 Decisions and alternatives

> **Owner:** A · **Persona:** `component-designer`

| Decision | Rationale | Alternatives considered |
| --- | --- | --- |
| Invalidate after commit, not before | Invalidating before the commit lets a concurrent check re-cache the old grants | Invalidate inside the transaction (cache is not transactional) |
| 30-second time-to-live | Bounds a lost invalidation well inside 60 seconds | 60 seconds (no margin), 5 seconds (low hit rate) |
| Missing user is an error, missing role is not | Matches the resolved questions in PRD-tech | Treat both as errors |
