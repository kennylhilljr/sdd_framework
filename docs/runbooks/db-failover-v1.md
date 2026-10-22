---
title: "Runbook: PostgreSQL primary failover"
type: runbook
version: 1
status: approved
owner: "Sam Ortiz (SRE lead)"
---

# Runbook: PostgreSQL primary failover (v1)

> **Owner:** A · **Persona:** `sre`. Applies to the authorization service database ([ADR 0001](../adr/0001-use-postgresql.md)).

## When to use it

The `iam.db.primary_unreachable` alert has fired for more than two minutes, or the managed database console reports the primary as failed.

## Impact while the primary is down

Access checks keep working from the grant cache and fall back to the replica on a miss. Grants and revocations fail with HTTP 503 until a new primary is promoted. Treat this as S1: revocation is unavailable (IAM-2).

## Steps

1. Confirm the primary is down in the managed database console; do not act on a single alert.
2. Promote the replica using the console's failover action.
3. Wait for the service health check to report `db: ok` (about 60 seconds).
4. Revoke and re-grant a test role on the `runbook-probe` user and confirm both return success.
5. Ask security administrators to repeat any revocation that failed during the outage; the audit log lists failed attempts.
6. Open a postmortem if the outage lasted more than 15 minutes.

## Rollback

If the promoted replica is unhealthy, fail back to the original primary once it recovers, then repeat step 4.
