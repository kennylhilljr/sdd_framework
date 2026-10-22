---
name: sdd-implement
description: "Build one planned task tests first, with @spec annotations that cite the acceptance criteria, then write the handoff. Use when a milestone plan exists and a task is next in the queue."
argument-hint: "<task reference, for example M1 task 4>"
metadata:
  version: 1.0.0
---

# sdd-implement

## Purpose

Turn one task into working, traced code. Tests come first and must fail for the expected reason before any code is written. Every test that exercises a criterion, and every behavior entry point in code, carries `@spec <ID>`.

## When to use

- A milestone plan exists in `docs/build/` and its LLDs are approved (Gate 3). The gate hook blocks this skill otherwise.
- A fix on the short path has its criterion and task ready.

## Inputs

1. `AGENTS.md` (commands, definition of done).
2. The task in `docs/build/M<n>-plan-vN.md`.
3. The component PRD (criterion text), the approved LLD and contracts.
4. `docs/test/test-plan-vN.md`.

## Steps

1. Pick the next task in queue order. Read its criterion IDs and the exact EARS text of each.
2. Dispatch the `implementer` persona with the Agent tool. The dispatch prompt must carry, because a subagent does not see this skill:
   - the criterion IDs in scope and their verbatim text;
   - "write failing tests first; do not write code until they fail for the expected reason";
   - "annotate the test that exercises each criterion with `// @spec <ID>` (or the comment syntax of the language), and the entry point of the behavior in code, not every helper";
   - "a criterion that admits two readings comes back as a question, never as a silently chosen reading";
   - the commands from `AGENTS.md` to run tests and type checks.
3. When the implementer returns, run the tests and `node tools/sdd/cli.mjs check` yourself. Fix or send back until both pass.
4. Run `node tools/trace-check/trace-check.mjs --write` to regenerate `docs/trace/coverage.md`.
5. Write or update the handoff: `node tools/sdd/cli.mjs new handoff --milestone M<n>` (first task of the milestone) recording what was built, the criterion IDs, the commands run and their results, and anything left open.
6. Hand over to `sdd-verify`. The implementer never verifies its own work.

## Outputs

- Code and tests with `@spec` annotations.
- Regenerated `docs/trace/coverage.md` (the test plan is not edited).
- `docs/build/M<n>-handoff-vN.md`.

## Stop and gate

Code review by a person. Verification by the `verifier` persona through `sdd-verify`.

## Rules

- No code without a failing test first.
- Cite acceptance criteria (`IAM-2`), not stories or requirements.
- If the code needs behavior no criterion states, stop and raise a spec gap; do not add untraced behavior.
- If the design is wrong, the fix starts in the LLD or SPEC, not in the code.
- Never edit approved documents; never change `status`.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-10-22 | First release |
