---
title: "Vision: one place to decide who can do what"
type: vision
version: 1
status: approved
owner: "Avery Chen (product owner)"
approved: 2026-02-02
---

# Vision: one place to decide who can do what (v1)

> **Owner:** H · **Persona:** none (`analyst` interviewed the owner)

## Why

Every product team in the example company builds its own permission checks. Each one stores roles differently, caches them differently and forgets to revoke them in different ways. When someone leaves a team, their access lingers for hours in some systems and days in others. Auditors ask who could do what on a given date, and nobody can answer quickly.

## For whom

- **Product engineers** who need a single call to ask "may this user do this action?"
- **Security and compliance staff** who need revocation to take effect quickly and to be provable afterwards.
- **Finance**, which bills each team for the authorization traffic it generates.

## Multi-year outcomes

1. Every product checks access through one shared authorization service.
2. A revoked role stops granting access everywhere within a minute.
3. Any access decision from the last seven years can be explained from the audit log.
4. Teams pay for authorization by usage, so heavy callers fund the capacity they need.

## Strategy

Start with the TECH component: roles, grants, revocation and audit. Add usage billing once the TECH component is stable. Keep the service small: it decides and records; it does not manage user profiles or passwords.

## Out of scope for the whole product

- User sign-in and passwords (owned by the identity provider).
- Fine-grained, per-record policy languages. Roles are enough for the first two years.
