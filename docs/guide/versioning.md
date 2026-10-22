# Versioning

Three things carry versions: the framework, each skill, persona and command, and each document.

## The framework

The framework version (now 1.0.0) is recorded in:

- `sdd.config.json` (`frameworkVersion`), so every repository shows which release it was set up with;
- `tools/lib/sdd-lib.mjs` (`FRAMEWORK_VERSION`);
- `package.json`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`;
- `CHANGELOG.md` in the framework repository.

A release bumps all of them together and adds a changelog entry. The framework follows semantic versioning: a major release changes a rule in a standard or a document format; a minor release adds a skill, persona, check or command; a patch fixes wording or a bug.

## Skills, personas and commands

Each file carries its version in front matter under `metadata`, which keeps it valid for Claude Code, claude.ai uploads and the Skills API:

```yaml
---
name: sdd-spec
description: Turn the intake brief into the parent and component PRDs.
metadata:
  version: 1.1.0
---
```

Skills and personas end with a changelog table whose first row is the current version:

```markdown
## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.1.0 | 2026-11-02 | Adds the divergence probe hand-off |
| 1.0.0 | 2026-10-22 | First release |
```

| Change | Bump |
| --- | --- |
| Changes what the skill or persona owns, its boundaries, inputs or outputs | major |
| Adds a step, a check or a capability | minor |
| Fixes wording | patch |

After a change:

1. bump `metadata.version` and add the changelog row;
2. run `node tools/sdd/cli.mjs catalog` to update [the catalog](catalog.md);
3. run `node tools/spec-lint/spec-lint.mjs`, which fails on a missing or invalid version or a missing changelog row.

CI fails when the catalog is out of date.

## Documents

Documents are versioned by file name (`PRD-iam-v2.md`). An approved version is frozen; `node tools/sdd/cli.mjs new --next <path>` creates the next one. ADRs are numbered once and superseded, never versioned. See the [standard](../standards/spec-driven-development-v1.md).

## Upgrading a repository to a new framework release

Run `upgrade` from the new framework release against the repository. adopt refuses a repository that already has `sdd.config.json`.

```bash
node <path-to-new-framework>/tools/sdd/cli.mjs upgrade .                      # dry run: lists what would change
node <path-to-new-framework>/tools/sdd/cli.mjs upgrade . --apply              # create missing files; propose the rest
node <path-to-new-framework>/tools/sdd/cli.mjs upgrade . --apply --overwrite  # replace framework files in place
```

`upgrade` only touches framework-owned files: skills, personas, commands, tools, templates, standards, guides and the framework diagrams. It never touches your documents, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json` or `sdd.config.json`.

- With `--apply`, missing framework files are created, and every framework file that differs from the new release is written to `.sdd-proposed/<same path>` for you to review and merge. Use this when you have customized skills or personas.
- With `--apply --overwrite`, differing framework files are replaced in place. Use this when you have not customized them.
- `--apply` refuses to run with uncommitted changes; `--allow-dirty` overrides that.

Afterwards, set `frameworkVersion` in `sdd.config.json` to the new release, delete `.sdd-proposed/`, then run `node tools/sdd/cli.mjs catalog` and `node tools/sdd/cli.mjs check`. The release notes are in the framework repository's `CHANGELOG.md`.
