# Differential audit: IAM-2

> **Owner:** A · **Persona:** `verifier`. Produced by the optional bidirectional differential (feature flag `differentialAudit`). A new audit of the same criterion replaces this file; git keeps the history.

| Field | Value |
| --- | --- |
| Criterion | IAM-2 |
| Date | 2026-10-20 |
| Git SHA | n/a (example) |
| Runs per direction | N = 3 |
| Code regions | `src/iam/revoke-role.ts` (`revokeRole`), `src/iam/authorize.ts` (`authorize`) |
| Classification | B-ONLY-DRIFT |
| Action | reconcile-EARS (documentation only) |

## Criterion text

When a user's role is revoked, the authorization service shall invalidate that user's cached grants within 60 seconds.

## A direction: implement from the criterion alone

Three blind sessions were given only the criterion text. All three deleted the user's cache entry when the role was removed. Two added a time-to-live; one did not. None of them ordered the invalidation after the database commit, because the criterion does not mention a transaction.

## B direction: reconstruct the criterion from stripped code

Three blind sessions were given the code with IDs and requirement-echoing names removed. The reconstructions agreed:

> When a role is removed from a user, the system shall delete that user's cached permissions after the change is saved, and cached permissions shall expire after 30 seconds.

## Findings

| # | Finding | Severity |
| --- | --- | --- |
| 1 | The code invalidates after the commit and relies on a 30-second time-to-live as a safety net. Both choices are in LLD-iam §3 and §9 but not in the criterion. The behavior meets IAM-2; the criterion is less specific than the design. | pure-documentation |

No hollow tests were found: the test for IAM-2 fails if the invalidation call is removed.

## Recommended reconciliation

Keep IAM-2 as written (it states the outcome the owner cares about). Add the invalidation order to the LLD's test plan section so an integration test pins it. No code change.
