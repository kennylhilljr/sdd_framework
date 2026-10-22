# Using the framework with Codex and other agents

The framework is built for Claude Code today, but nothing in it depends on one tool. The rules live in plain files that any agent can read.

## What every agent reads

| File | Role |
| --- | --- |
| `AGENTS.md` | The constitution. Canonical for every agent; Claude Code reaches it through `CLAUDE.md` (`@AGENTS.md`). |
| `.claude/skills/<skill>/SKILL.md` | Step-by-step instructions for each stage of the chain |
| `.claude/agents/<persona>.md` | Persona definitions: what each role owns, its inputs, limits and definition of done |
| `docs/standards/` | The normative rules |
| `docs/templates/` | The documents, with an owner and persona on every section |

## Working without skills or subagents

An agent that cannot load skills or spawn subagents follows the same chain by hand:

1. Read `AGENTS.md` and `docs/README.md`.
2. Pick the step from the workflow table in `AGENTS.md` and open its `SKILL.md`.
3. For each section the skill writes, read the persona named in the template's owner line and stay inside its limits.
4. Never write an H section; add a `- [ ] Q:` line instead.
5. Never approve a document or verify your own work.
6. Run `node tools/sdd/cli.mjs check` before finishing.

The hooks are Claude Code features, so other agents are not blocked by them. CI enforces the same rules for every agent: spec-lint fails on malformed or incomplete documents, and trace-check fails on broken links.

## Adding support for a new agent

When another agent gains skills or subagents:

1. Point its skill or agent discovery at `.claude/skills/` and `.claude/agents/` (or copy them to the folder it expects, keeping the same files).
2. Register equivalents of the two hooks if it supports hooks; both scripts read JSON on stdin and exit 2 to block.
3. Record the change in `CHANGELOG.md` and add a section to this guide.

Keep `AGENTS.md` canonical. Tool-specific files should only point to it.
