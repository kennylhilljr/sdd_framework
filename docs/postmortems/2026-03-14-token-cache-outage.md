---
title: "Postmortem: stale grants after a cache outage"
status: approved
owner: "Sam Ortiz (SRE lead)"
date: 2026-03-14
severity: S1
---

# Postmortem: stale grants after a cache outage (2026-03-14)

> **Owner:** C · **Persona:** `sre` drafted; the owner approved. Blameless.

## Summary

During a 25-minute grant cache outage in the pilot, three revocations succeeded in the database but their cache invalidations failed. When the cache came back it reloaded from a snapshot taken before the revocations, so the revoked roles kept granting access for up to 12 minutes. This breached INV-1, so it was triaged as S1.

## Timeline (UTC)

| Time | Event |
| --- | --- |
| 09:02 | Grant cache node fails; checks fall back to the database |
| 09:10 to 09:20 | Three revocations commit; invalidations fail and are logged |
| 09:27 | Cache restored from a snapshot taken at 08:55 |
| 09:39 | On-call notices `tech.cache_invalidation_failed` alerts and flushes the cache |

## Impact

Three users kept a revoked role for up to 12 minutes. No misuse was found in the audit log.

## Root cause: where intent was lost

The criterion (TECH-2) and the LLD were correct. The gap was in the LLD's operational design: restoring the cache from a snapshot was never specified, so the restore path ignored the 30-second time-to-live. The fix starts at LLD-tech, not in code.

## Fix, walking the arrow

1. LLD-tech: the cache is never restored from a snapshot; it starts empty and warms from the database (next LLD version).
2. Test: a test that restarts the cache after a failed invalidation and expects a denial.
3. Code: remove the snapshot restore.
4. Runbook: flush the cache after any cache outage.

## Actions

| Action | Owner | Due |
| --- | --- | --- |
| Next version of LLD-tech without snapshot restore | Riley Park | 2026-03-21 |
| Test for cache restart after failed invalidation | Morgan Lee | 2026-03-24 |
| Alert on invalidation failures pages immediately | Sam Ortiz | 2026-03-17 |
