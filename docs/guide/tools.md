# Tools reference

Every tool is a Node 20 script with no dependencies. Run them from anywhere inside a repository; they find the root by looking for `sdd.config.json`.

## sdd CLI

`node tools/sdd/cli.mjs <command> [options]`. Add `--help` to any command for its usage; `new --help` lists the document types and their options.

Flags that are switches (`--apply`, `--git`, `--json`, `--force`, `--dry-run`, `--allow-dirty`, `--overwrite`, `--check`, `--advisory`, `--write`, `--help`) never take a value, so `init --git ../my-app` still treats `../my-app` as the folder. Other flags take the next word as their value.

| Command | Options | What it does |
| --- | --- | --- |
| `init [DIR]` | `--name`, `--components name:PREFIX,...`, `--owner`, `--git`, `--dry-run`, `--force` | Sets up the framework in a new repository. See [new repository](new-repository.md). |
| `adopt [DIR]` | `--apply`, `--allow-dirty`, `--json`, `--force` | Analyzes an existing repository and adds the framework without changing existing files. Dry run unless `--apply`. Stops if `sdd.config.json` already exists (use `upgrade`). See [existing repository](existing-repository.md). |
| `upgrade [DIR]` | `--apply`, `--overwrite`, `--allow-dirty` | Brings a newer framework release into a repository that already uses it. Only framework-owned files are considered. Dry run unless `--apply`; differing files go to `.sdd-proposed/` unless `--overwrite`. See [versioning](versioning.md#upgrading-a-repository-to-a-new-framework-release). |
| `doctor [DIR]` | | Checks Node, git, Claude Code, Codex (optional), configuration, hooks, skills, personas, and runs both checks. Exits 1 if a required check fails. |
| `check` | `--advisory`, `--base REF` | Runs spec-lint and trace-check. Advisory automatically when `adoption.mode` is `advisory`. |
| `new TYPE` | `--component`, `--prefix`, `--name`, `--milestone`, `--title`, `--help` | Creates a document from its template with the next version number, then updates the doc map. Types: `vision`, `research`, `prd`, `prd-component`, `adr`, `spec`, `lld`, `test-plan`, `kickoff`, `plan`, `handoff`, `runbook`, `postmortem`. |
| `new --next PATH` | | Creates the next version of a frozen document as a draft, with `supersedes:` set. `PATH` can be relative to the current folder or to the repository root. |
| `docmap` | `--check` | Regenerates the doc map table in the file named by `paths.docMap` (default `docs/README.md`). With `--check`, exits 1 if it is out of date. |
| `catalog` | `--check` | Regenerates `docs/guide/catalog.md` from the skills, personas and commands. With `--check`, exits 1 if it is out of date. |
| `version` | | Prints the framework version. |

## spec-lint

`node tools/spec-lint/spec-lint.mjs [--root DIR] [--json] [--advisory]`

| Check | Level |
| --- | --- |
| Versioned documents have front matter with `title`, `type`, `version`, `status`, `owner` | error |
| `version` matches the `-vN` in the file name | error |
| `status` is a known value (ADRs have their own set) | error |
| Approved documents have no open questions and no template placeholders | error |
| ADR numbers are unique | error |
| Requirement IDs are defined only once across the PRDs in force (latest approved version, plus new IDs in a newer draft) | error |
| Component PRDs declare `prefix`, and their IDs use it | error |
| Criteria have a priority and EARS (or Given/When/Then) form | error when approved, warning in drafts |
| A criterion with two "shall" responses | warning |
| Component requirements cite a parent that exists | warning |
| Skills, personas and commands have a `description`, a semver `metadata.version`, and a `## Changelog` row for that version (skills and personas also need `name`) | error |
| Template sections have an owner line | warning |

## trace-check

`node tools/trace-check/trace-check.mjs [--root DIR] [--write] [--base REF] [--json] [--advisory]`

| Check | Level |
| --- | --- |
| Annotation cites an ID no PRD defines (reverse orphan) | error |
| Approved criterion has no test citing it and is not deferred | error |
| `docs/trace/coverage.md` marks a criterion covered, but no test cites it (hollow status) | error |
| P1 criterion is deferred | error |
| Annotation cites a story or requirement instead of a criterion | warning |
| Criterion has a test but no code entry point | warning |
| Component changed since its last audit, or not audited within `trace.staleAfterDays` | warning |
| Annotation reach below `trace.reachWarnBelow` | warning |

Enforcement follows the latest approved version of each PRD. While a newer version is a draft (for example `PRD-iam-v2.md` while v1 is approved), v1's criteria stay enforced and the IDs that v2 adds are defined but not enforced until v2 is approved.

Deferred criteria are read from the `deferred:` list in the test plan's front matter. The test plan is the one named by `paths.testPlan`, or by default the latest `docs/test/test-plan-vN.md`, preferring an approved version.

| Option | Effect |
| --- | --- |
| `--write` | Regenerates `docs/trace/coverage.md` (derived status) and the coverage counts in `docs/trace/index.yaml`. The test plan is never edited. |
| `--base REF` | Reports reach only for files changed since `REF` (for example `origin/main`) |
| `--advisory` | Reports problems but always exits 0 |
| `--json` | Machine-readable output |

## Hooks

Registered in `.claude/settings.json`. Both exit 0 on any internal error, so a broken hook never breaks a session.

| Hook | Event | Blocks |
| --- | --- | --- |
| `tools/hooks/gate.mjs` | `PreToolUse` on `Skill`, and `UserPromptSubmit` | `sdd-hld` without an approved PRD, `sdd-lld` without an approved SPEC, `sdd-tasks` without an approved LLD, `sdd-implement` without a plan. The skill name is read from the Skill tool's `skill` field (or `name` or `command`), never from free text, so other skills that mention these names are not blocked. |
| `tools/hooks/protect-approved.mjs` | `PreToolUse` on `Edit`, `Write`, `MultiEdit` | Edits to documents in `docs/` whose status is `approved`, `superseded`, `accepted`, `rejected` or `deprecated`. It suggests `new --next` for a versioned document and a new superseding ADR for an ADR. |

To switch a hook off, set its flag in `sdd.config.json`:

```json
{ "features": { "gateHook": false, "protectApprovedDocs": false } }
```

The hooks stay registered and simply allow everything, so switching back on needs no other change.

## Configuration paths

`sdd.config.json` sets where the tools look. Every key is optional.

| Key | Default | Meaning |
| --- | --- | --- |
| `paths.docs` | `docs` | Documentation root |
| `paths.codeRoots` | `["src"]` | Folders scanned for `@spec` in code |
| `paths.testRoots` | `["test", "tests"]` | Folders whose files count as tests |
| `paths.traceIndex` | `docs/trace/index.yaml` | Per-component audit state |
| `paths.coverage` | `docs/trace/coverage.md` | Generated coverage report |
| `paths.docMap` | `docs/README.md` | File that holds the generated doc map (adopt uses `docs/DOCMAP.md` when `docs/README.md` already exists) |
| `paths.testPlan` | latest `docs/test/test-plan-vN.md` | Test plan that lists deferred criteria |

## Feature flags

| Flag | Default | Effect |
| --- | --- | --- |
| `gateHook` | on | Gate hook enforces approvals |
| `protectApprovedDocs` | on | Approved documents are frozen |
| `reachReport` | on | trace-check reports annotation reach |
| `divergenceProbe` | off | `sdd-clarify` runs the blind divergence probe |
| `differentialAudit` | off | `sdd-verify` runs the bidirectional differential |

## Packaging as a plugin

In the framework repository, `.claude-plugin/plugin.json` packages the skills, personas, commands and hooks as a Claude Code plugin, and `.claude-plugin/marketplace.json` lets others install it. These two files live only in the framework repository; `init`, `adopt` and `upgrade` do not copy them into your project.

```text
/plugin marketplace add <owner>/<repo>
/plugin install sdd-framework@sdd-framework
```

Validate the package with `claude plugin validate .` in the framework repository before publishing. A repository set up with `sdd init` already has the components under `.claude/`; installing the plugin as well can load the same skills and personas twice, so use one or the other in a given project.
