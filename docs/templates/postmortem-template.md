---
title: "{{TITLE}}"
type: postmortem
status: draft
owner: "[Name]"
severity: S1
date: {{DATE}}
---

# Postmortem: {{TITLE}}

## How to use this template

*Every S0 and S1 incident gets a postmortem. The `sre` drafts it and the owner approves it. It is blameless: it names the layer where intent was lost, not a person.*

## Summary

> **Owner:** C · **Persona:** `sre` drafts; the owner approves

*What happened, who was affected, for how long.*

## Severity

> **Owner:** H · **Persona:** none (the owner confirms the agent's triage)

| Severity | Urgency | Impact | Response |
| --- | --- | --- | --- |
| S0 | Critical | Extensive | Immediate |
| S1 | High | Large | Urgent, within the normal schedule |
| S2 | Moderate | Moderate | Ranked against other work |
| S3 | Low | Minor | Routine work |
| S4 | Negligible | Negligible | Backlog |

*This incident: S1. A breach of an invariant is always S0 or S1.*

## Timeline

> **Owner:** A · **Persona:** `sre`

| Time (UTC) | Event |
| --- | --- |
| | |

## Root cause and the layer where intent was lost

> **Owner:** C · **Persona:** `sre` with `verifier`

| Layer | What was wrong |
| --- | --- |
| PRD, SPEC, LLD, test, code or operations | |

*Affected requirement IDs:*

## Actions

> **Owner:** C · **Persona:** `sre` drafts; the owner assigns

| Action | Layer | Owner | Severity or priority | Due |
| --- | --- | --- | --- | --- |
| | | | | |
