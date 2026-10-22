# {{PROJECT}}: instructions for people and coding agents

This file is the constitution for this repository. Every person and every agent (Claude Code, Codex or any tool that reads `AGENTS.md`) reads it first. It is human-owned: agents may propose changes but never edit it without the owner's approval.

Framework: spec-driven development (SDD) {{FRAMEWORK_VERSION}}. Owner: {{OWNER}}.

## Read first

- [docs/README.md](docs/README.md) is the doc map: every layer and the latest version of each document. The latest approved documents are the source of truth. If code and docs disagree, raise it; do not silently diverge.
- [docs/standards/spec-driven-development-v1.md](docs/standards/spec-driven-development-v1.md) defines the layers, ownership tags, gates and ID scheme.
- [docs/standards/agent-personas-v1.md](docs/standards/agent-personas-v1.md) defines the agent personas and their limits.

## Ownership

Every section of every template is tagged with its owner:

- **H** Human-authored: never write it. Ask, or list it as an open question (`- [ ] Q: ...`).
- **C** Co-authored: draft two or three options with tradeoffs; the owner decides.
- **A** Agent-generated: write it from the H and C sections, as the persona named in the template.

## Rules

- **Approved versions are frozen.** Never edit a document whose status is `approved`; create the next version with `node tools/sdd/cli.mjs new --next <path>`. ADRs are superseded by a new ADR.
- **Gates are human.** Gate 0 approves the problem framing (PRD Section 1, after the seed answers), Gate 1 the PRD, Gate 2 the SPEC (HLD), Gate 3 the LLD. Agents never set `status: approved`. Hooks enforce Gates 1 to 3; Gate 0 is checked by `sdd-spec`, not by a hook.
- **Every requirement has a stable ID**, never renumbered and never reused. Acceptance criteria use `<PREFIX>-<n>` (for example `IAM-2`).
- **Tests and code cite the criteria they satisfy** with a comment such as `// @spec IAM-2`: on the test that exercises the behavior and on the entry point of the behavior in code, not on every helper.
- **Fixes start where intent was lost.** Find the layer where behavior left the spec and change that layer first.
- **A change that crosses components stops for a person** and goes into the next SPEC version, with an ADR when the system's shape changes.
- **Never verify your own work.** The `verifier` persona checks work it did not produce.
- **Project knowledge goes into the docs**, not into an agent's private memory.
- **Rationale inferred from existing code** is tagged `[inferred]` until the owner confirms it.
- **Writing style for docs:** short sentences, plain words, no em dashes.

<!-- Add organization rules here: security, data handling, approved stack, vendors. -->

## Commands

```bash
npm test                              # tests                      (replace with this project's command)
npm run typecheck                     # type check or lint         (replace with this project's command)
node tools/sdd/cli.mjs check          # spec-lint and trace-check
node tools/sdd/cli.mjs doctor         # check the local environment
node tools/sdd/cli.mjs new --help     # create a document from a template
```

## Workflow

| Step | Skill (Claude Code) | Persona | Human gate |
| --- | --- | --- | --- |
| Capture intent | `/sdd-intake` | `analyst` | Owner answers the twelve seed questions; Gate 0: approve the problem framing |
| Write the PRD | `/sdd-spec` | `product-writer` | |
| Close gaps | `/sdd-clarify` | `product-writer`, `verifier` | Gate 1: approve the PRD |
| High-level design | `/sdd-hld` | `architect`, `security-reviewer`, `sre` | Gate 2: choose ADRs, approve the SPEC |
| Low-level design | `/sdd-lld` | `component-designer`, `test-architect` | Gate 3: review contracts, schema, authZ |
| Plan | `/sdd-tasks` | `planner` | |
| Build | `/sdd-implement` | `implementer` | Code review |
| Verify | `/sdd-verify` | `verifier` | |
| Adopt an existing codebase | `/sdd-adopt` | `analyst`, `architect` | |
| Triage support work | `/sdd-triage` | `sre`, `verifier`, `planner` | Owner confirms S0 and S1 |

Bugs and small changes take the short path: update the spec, then tasks, then code.

## Agents without skills or subagents (Codex and others)

Follow the same workflow by hand. For each step, read the matching `.claude/skills/<skill>/SKILL.md` and follow it; when it names a persona, read `.claude/agents/<persona>.md` and stay inside that persona's limits. Run `node tools/sdd/cli.mjs check` before you finish.

## Definition of done

A change is done when tests pass, `node tools/sdd/cli.mjs check` passes, every new or changed behavior cites its criterion with `@spec`, the docs and the doc map are current, and a handoff note records what was verified.
