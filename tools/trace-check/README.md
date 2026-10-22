# trace-check

Checks the links between requirements, tests and code. Node 20 or later, no dependencies; git is optional (staleness and reach use it when present).

```bash
node tools/trace-check/trace-check.mjs                    # exit 1 on errors
node tools/trace-check/trace-check.mjs --write            # regenerate docs/trace/coverage.md and the trace index
node tools/trace-check/trace-check.mjs --base origin/main # annotation reach for files changed since main
node tools/trace-check/trace-check.mjs --advisory --json
```

## How links are made

Tests and code cite the acceptance criteria they satisfy in a comment, in any language:

```ts
// @spec IAM-2
it("IAM-2: invalidates cached grants when a role is revoked", () => { /* ... */ });
```

```python
# @spec IAM-2, IAM-4
def revoke_role(user_id, role): ...
```

Put the annotation on the test that exercises the behavior and on the entry point of the behavior in code (the topmost function or handler that owns it), not on every helper. Files under `paths.testRoots` in `sdd.config.json`, or named like `*.test.*`, `*.spec.*`, `*_test.*` or `test_*`, count as tests.

## What it checks

| Check | Result |
| --- | --- |
| Reverse orphan: `@spec` cites an ID no PRD defines | Error |
| Uncovered: a criterion in an approved PRD has no test citing it and is not deferred | Error |
| A P1 criterion is listed in the test plan's `deferred:` | Error |
| Hollow status: `docs/trace/coverage.md` says `covered` but no test cites the ID | Error (fixed by `--write`) |
| A criterion has a test but no code entry point cites it | Warning |
| `@spec` cites a story, requirement or NFR instead of a criterion | Warning |
| A component changed since `audited_sha`, or was audited more than `trace.staleAfterDays` ago | Warning |
| Annotation reach below `trace.reachWarnBelow` (share of source files with at least one `@spec`) | Warning |
| Criteria in draft PRDs without tests | Info only |

Reach is measured per file, which is an approximation: it shows when new code lands with no link to any requirement.

## Status lives in derived files

`--write` regenerates `docs/trace/coverage.md` (the path in `paths.coverage`) and the `criteria`, `covered`, `deferred` and `gaps` counts per component in `docs/trace/index.yaml`. It never edits the test plan, which keeps the strategy, the gaps and the `deferred:` list. Approved documents never carry status. The verifier persona maintains `status`, `audited`, `audited_sha`, `drift` and `next` in the index.
