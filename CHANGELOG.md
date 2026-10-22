# Changelog

All notable changes to the SDD framework are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the framework uses [semantic versioning](https://semver.org/). Versions of individual skills, personas and commands are tracked in their own files and in [the catalog](docs/guide/catalog.md).

## Unreleased

Nothing yet.

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
- A worked example: an IAM component traced from vision to code, and a draft billing component.
