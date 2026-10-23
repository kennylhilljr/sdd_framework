# Changelog

All notable changes to the SDD framework are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the framework uses [semantic versioning](https://semver.org/). Versions of individual skills, personas and commands are tracked in their own files and in [the catalog](docs/guide/catalog.md).

## Unreleased

Nothing yet.

## 1.1.1 (2026-10-22)

### Fixed

- trace-check: a milestone plan put every approved criterion of each component it covers in build, so criteria of later milestones, and of tasks not yet built, failed CI. Now each current plan (latest version, not superseded) is read on its own: it makes due only the criteria it names, with ranges such as `TECH-1 to TECH-4` expanded; when a task table has a Status column, only the criteria of `done` tasks (or `merged`, `complete`, `completed`) are due and prose mentions do not count. A plan that names no criteria of a component still covers all of them.

### Changed

- Standard v3 (in review) records the rule in "When evidence is required". v2 is superseded.
- The plan template's task table has a Status column, and `sdd-implement` (1.1.1) marks a task done when it is built.

## 1.1.0 (2026-10-22)

Aligns the toolkit with the white paper's operating model, keeps it reusable, and adds a Tech domain reference profile.

### Changed

- Organizational scope (L0 to L3) is now separate from the delivery artifact chain, which is unnumbered, and from the gates. The doc map, templates, scaffolds, diagrams and the doc map generator no longer use L0 to L6 for document stages.
- Standard v2 (in review): Product-to-Engineering bridge, portable core and local choices, scope metadata, decision owner definitions, the intake checkpoint (formerly Gate 0), component-bound gates, the ID lifecycle, evidence states, the drift rule, priority and severity as separate lenses, and open decisions. v1 stays approved until the owner approves v2.
- Decision owners: functional requirements, acceptance criteria, the test strategy, public contracts, persisted schema and authorization enforcement are now C in the templates, skills and personas.
- Gate hook: each gate is bound to the component or milestone being advanced. `sdd-lld <component>` needs the SPEC and that component's PRD approved; `sdd-tasks <component>` needs its LLD; `sdd-implement <milestone>` needs the plan and an approved LLD for every component the plan covers. With several components and none named, it asks.
- trace-check: evidence states `planned`, `test linked` (formerly `covered`), `passing`, `failing`, `deferred`, `excepted`, `drifted` and `gap`. Missing tests are an error only once a milestone plan exists for the component, so design work is not blocked right after Gate 1.
- The trace index is an audit record: scope, owner, findings, disposition, drift as a list of IDs, and the governing artifact versions. Evidence goes stale when a governing PRD, SPEC, LLD or test plan is approved or changed after the last audit.
- README, framework overview, usage and other guides: bridge-first positioning, audience routes, a synthetic example disclaimer, narrowed traceability claims, and an honest account of what the hooks enforce for agents other than Claude Code.
- `AGENTS.md` is a repository instruction adapter, not organizational authority.
- All skills, personas and commands that changed moved to 1.1.0 with changelog rows.

### Added

- `docs/scope/scope-map.yaml`, checked by spec-lint (levels L0 to L3, each parent one level up), and scope metadata in front matter (`scope_level`, `scope_name`, `scope_parent`, `affected_scopes`, `artifact_type`, `derives_from`, `satisfies`).
- ID history tables in PRDs; spec-lint checks that an ID never moves between document families and that a removed ID is recorded.
- `ids.criterionPattern` for a richer criterion form such as `AM-PRIV-001-AC1`.
- `approvals.requireApprover` with `approved_by` and `approved` in front matter.
- `trace-check --results` (and `paths.testResults`) for JUnit XML reports.
- The doc map now has three views: the organizational scope map, the delivery artifact index and the approval workflow.
- `docs/adr/README.md`, a `CODEOWNERS` scaffold (inert until filled in), a scaffold README on where scaffold links resolve, and a test that every link in a freshly installed repository resolves.
- Glossary entries for the scope model, artifact chain, decision owners and evidence.

### Fixed

- The skill chain diagram still described an older workflow (`brief.md`, `spec.md`, `hld.md`).
- The sample postmortem was not linked from any index.

## 1.0.0 (2026-10-22)

### Added

- Document stack from vision to code (L0 to L6) under a constitution, with templates for every artifact and an owner (H, C or A) and persona on every section.
- Standards: the spec-driven development standard and the agent persona standard.
- Ten Claude Code skills: the eight-step chain (`sdd-intake`, `sdd-spec`, `sdd-clarify`, `sdd-hld`, `sdd-lld`, `sdd-tasks`, `sdd-implement`, `sdd-verify`), plus `sdd-adopt` for existing codebases and `sdd-triage` for support work.
- Eleven agent personas with versions and changelogs.
- Commands that wrap the skills.
- `spec-lint` and `trace-check`, with zero dependencies on Node 20 or later.
- Gate hook and protect-approved hook, each behind a feature flag.
- `sdd` CLI: `init`, `adopt`, `doctor`, `check`, `new`, `docmap`, `catalog`, `version`.
- `sdd adopt` for running applications: dry run by default, never changes existing files, writes an inventory and a list of missing information.
- Plugin and marketplace manifests, a dev container, and CI on Linux, macOS and Windows.
- A worked example: a TECH component traced from vision to code, and a draft billing component.
