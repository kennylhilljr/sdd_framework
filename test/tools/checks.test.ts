// Tests for the shared library, spec-lint, trace-check and the hooks.
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyId, parseYaml, parseTables, parseFrontMatter, loadConfig, parseArgs } from "../../tools/lib/sdd-lib.mjs";
import { lint } from "../../tools/spec-lint/spec-lint.mjs";
import { analyze, write } from "../../tools/trace-check/trace-check.mjs";
import { analyze as analyzeTrace, readJUnit } from "../../tools/trace-check/trace-check.mjs";
import { decide as gateDecide, skillFromEvent, argsFromEvent } from "../../tools/hooks/gate.mjs";
import { decide as protectDecide } from "../../tools/hooks/protect-approved.mjs";
import { tempDir, writeFiles, read, CONFIG, componentPrd, testPlan, doc } from "./helpers.js";

const SPEC = "@" + "spec"; // built at runtime so trace-check does not read fixtures as real annotations
const EARS = "When a role is revoked, the system shall invalidate cached grants.";
// A milestone plan for TECH: once it exists, approved TECH criteria need tests.
const PLAN = { "docs/build/M1-plan-v1.md": doc("plan", "approved", "milestone: M1\n", "| Task | Criteria |\n| --- | --- |\n| M1-1 | TECH-1, TECH-2 |\n") };

describe("library", () => {
  it("classifies requirement IDs", () => {
    expect(classifyId("TECH-2")).toMatchObject({ kind: "criterion", prefix: "TECH" });
    expect(classifyId("**TECH-US-1**")).toMatchObject({ kind: "us", prefix: "TECH" });
    expect(classifyId("FR-3")).toMatchObject({ kind: "parent-fr" });
    expect(classifyId("NFR-1")).toMatchObject({ kind: "parent-nfr" });
    expect(classifyId("hello")).toBeNull();
  });

  it("parses the YAML subset used by front matter and the trace index", () => {
    const y: any = parseYaml("# comment\ncomponents:\n  tech:\n    status: AUDITED\n    audited_sha: null\n    next: \"Write: tests\" # trailing\nlist: [TECH-1, TECH-2]\n");
    expect(y.components.tech.status).toBe("AUDITED");
    expect(y.components.tech.audited_sha).toBeNull();
    expect(y.components.tech.next).toBe("Write: tests");
    expect(y.list).toEqual(["TECH-1", "TECH-2"]);
  });

  it("parses front matter with nested metadata", () => {
    const fm: any = parseFrontMatter("---\nname: x\nmetadata:\n  version: 1.2.3\n---\nbody\n");
    expect(fm.data.metadata.version).toBe("1.2.3");
    expect(fm.body).toBe("body\n");
  });

  it("never lets a boolean flag swallow the folder argument", () => {
    const a: any = parseArgs(["init", "--git", "../app", "--components", "tech:TECH"]);
    expect(a._).toEqual(["init", "../app"]);
    expect(a.git).toBe(true);
    expect(a.components).toBe("tech:TECH");
  });

  it("parses markdown tables and keeps line numbers", () => {
    const t: any = parseTables("text\n\n| ID | Criterion |\n| --- | --- |\n| TECH-1 | a \\| b |\n", 10);
    expect(t[0].rows[0].criterion).toBe("a | b");
    expect(t[0].rows[0]._line).toBe(15);
  });
});

function repo(files: Record<string, string>) {
  const root = tempDir("check");
  writeFiles(root, { "sdd.config.json": CONFIG, ...files });
  return root;
}

describe("spec-lint", () => {
  it("passes a well-formed approved component PRD", () => {
    const root = repo({ "docs/prd/components/PRD-tech-v1.md": componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`) });
    expect(lint(root).errors).toEqual([]);
  });

  it("rejects criteria that are not EARS or lack a priority, in approved documents", () => {
    const root = repo({ "docs/prd/components/PRD-tech-v1.md": componentPrd("approved", "| TECH-1 | Revocation is fast. | TECH-FR-1 | |") });
    const msgs = lint(root).errors.map((e) => e.msg).join("\n");
    expect(msgs).toMatch(/not in EARS form/);
    expect(msgs).toMatch(/needs a Priority/);
  });

  it("only warns about the same problems in drafts", () => {
    const root = repo({ "docs/prd/components/PRD-tech-v1.md": componentPrd("draft", "| TECH-1 | Revocation is fast. | TECH-FR-1 | |") });
    const r = lint(root);
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("rejects open questions, placeholders and version mismatches", () => {
    const doc = componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`).replace("version: 1", "version: 2") + "\n- [ ] Q: who owns this?\nOwner: [Name]\n";
    const root = repo({ "docs/prd/components/PRD-tech-v1.md": doc });
    const msgs = lint(root).errors.map((e) => e.msg).join("\n");
    expect(msgs).toMatch(/open questions/);
    expect(msgs).toMatch(/placeholder/);
    expect(msgs).toMatch(/does not match file name/);
  });

  it("rejects duplicate IDs and IDs outside the component prefix", () => {
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |\n| BILL-1 | ${EARS} | TECH-FR-1 | P1 |`),
      "docs/prd/components/PRD-other-v1.md": componentPrd("draft", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`),
    });
    const msgs = lint(root).errors.map((e) => e.msg).join("\n");
    expect(msgs).toMatch(/already defined/);
    expect(msgs).toMatch(/does not use this component's prefix/);
  });

  it("requires a semver version and a changelog entry on skills and agents", () => {
    const root = repo({
      ".claude/skills/demo/SKILL.md": "---\nname: demo\ndescription: d\nmetadata:\n  version: 1.0.0\n---\n# Demo\n",
      ".claude/agents/a.md": "---\nname: a\ndescription: d\nmetadata:\n  version: 1.0.0\n---\n## Changelog\n\n| Version | Date | Change |\n| --- | --- | --- |\n| 1.0.0 | 2026-10-22 | First |\n",
    });
    const errs = lint(root).errors;
    expect(errs).toHaveLength(1);
    expect(errs[0].msg).toMatch(/Changelog/);
  });

  it("checks the organizational scope map and scope metadata (L0 to L3 only)", () => {
    const root = repo({
      "docs/scope/scope-map.yaml": "scopes:\n  top:\n    level: L0\n    parent: null\n  dom:\n    level: L1\n    parent: top\n  app:\n    level: L3\n    parent: dom\n  stage:\n    level: L4\n",
      "docs/vision/vision-v1.md": doc("vision", "draft", "scope_level: L4\nscope_name: nowhere\nartifact_type: strategic-direction\nderives_from: docs/missing-v1.md\n"),
    });
    const r = lint(root);
    const errs = r.errors.map((e) => e.msg).join("\n");
    expect(errs).toMatch(/scope app \(L3\) has parent dom \(L1\); a parent is exactly one level up/);
    expect(errs).toMatch(/scope stage has level "L4"/);
    expect(errs).toMatch(/scope_level "L4" is not one of L0, L1, L2, L3/);
    const warns = r.warnings.map((w) => w.msg).join("\n");
    expect(warns).toMatch(/scope_name "nowhere" is not in/);
    expect(warns).toMatch(/derives_from docs\/missing-v1.md does not exist/);
  });

  it("requires an ID that leaves a PRD to be recorded in its ID history", () => {
    const v1 = componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |\n| TECH-2 | ${EARS} | TECH-FR-1 | P2 |`);
    const v2 = componentPrd("draft", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |\n| TECH-3 | ${EARS} | TECH-FR-1 | P2 |`).replace("version: 1", "version: 2");
    const root = repo({ "docs/prd/components/PRD-tech-v1.md": v1, "docs/prd/components/PRD-tech-v2.md": v2 });
    expect(lint(root).warnings.map((w) => w.msg).join("\n")).toMatch(/TECH-2 was defined in v1 and is gone from v2/);
    const history = "\n## ID history\n\n| ID | Status | Replaced by | Reason |\n| --- | --- | --- | --- |\n| TECH-2 | superseded | TECH-3 | New trigger |\n";
    writeFileSync(join(root, "docs/prd/components/PRD-tech-v2.md"), v2 + history);
    const r = lint(root);
    expect(r.warnings.map((w) => w.msg).join("\n")).not.toMatch(/TECH-2/);
    expect(r.errors).toEqual([]);
  });

  it("rejects an ID that comes back after it was withdrawn or removed", () => {
    const v = (n: number, rows: string, extra = "") => componentPrd(n === 1 ? "approved" : "draft", rows).replace("version: 1", `version: ${n}`) + extra;
    const hist = "\n## ID history\n\n| ID | Status | Replaced by | Reason |\n| --- | --- | --- | --- |\n| TECH-5 | withdrawn | | Dropped |\n";
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": v(1, `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |\n| TECH-5 | ${EARS} | TECH-FR-1 | P2 |`),
      "docs/prd/components/PRD-tech-v2.md": v(2, `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`, hist),
      "docs/prd/components/PRD-tech-v3.md": v(3, `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |\n| TECH-5 | When a user leaves, the system shall revoke all roles. | TECH-FR-1 | P2 |`),
    });
    expect(lint(root).errors.map((e) => e.msg).join("\n")).toMatch(/TECH-5 is defined again after it was retired/);
  });

  it("can require who approved a document and when", () => {
    const root = repo({ "docs/spec/SPEC-v1.md": doc("spec", "approved") });
    expect(lint(root).errors).toEqual([]);
    const cfg = JSON.parse(CONFIG);
    cfg.approvals = { requireApprover: true };
    writeFileSync(join(root, "sdd.config.json"), JSON.stringify(cfg));
    expect(lint(root).errors.map((e) => e.msg).join("\n")).toMatch(/needs approved_by and approved/);
    writeFileSync(join(root, "docs/spec/SPEC-v1.md"), doc("spec", "approved", "approved_by: \"Test Owner (architect)\"\napproved: 2026-10-01\n"));
    expect(lint(root).errors).toEqual([]);
  });

  it("requires a changelog entry on commands too", () => {
    const root = repo({ ".claude/commands/x.md": "---\ndescription: d\nmetadata:\n  version: 1.0.0\n---\nbody\n" });
    expect(lint(root).errors.map((e) => e.msg).join("\n")).toMatch(/Changelog/);
  });
});

describe("trace-check", () => {
  const prd = componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |\n| TECH-2 | ${EARS} | TECH-FR-1 | P3 |`);

  it("passes when every approved criterion is tested or deferred", () => {
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan(["TECH-2"]).replace("status: draft", "status: approved"),
      "src/tech/revoke.ts": `// ${SPEC} TECH-1\nexport const revoke = () => 1;\n`,
      "test/tech/revoke.test.ts": `// ${SPEC} TECH-1\n`,
    });
    const r = analyze(root);
    expect(r.errors).toEqual([]);
    expect(r.rows.find((x: { id: string }) => x.id === "TECH-2")?.status).toBe("deferred");
  });

  it("fails on an untested criterion, a reverse orphan and a deferred P1", () => {
    const root = repo({
      ...PLAN,
      "docs/prd/components/PRD-tech-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan(["TECH-1"]).replace("status: draft", "status: approved"),
      "test/tech/revoke.test.ts": `// ${SPEC} TECH-9\n`,
    });
    const msgs = analyze(root).errors.map((e: { msg: string }) => e.msg).join("\n");
    expect(msgs).toMatch(/TECH-9 cites an ID that no PRD defines/);
    expect(msgs).toMatch(/TECH-1 is P1 and cannot be deferred/);
    expect(msgs).toMatch(/TECH-2 \(P3\) has no test/);
  });

  it("keeps enforcing the approved version while a newer draft is written", () => {
    const v2 = componentPrd("draft", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |\n| TECH-3 | ${EARS} | TECH-FR-1 | P1 |`).replace("version: 1", "version: 2");
    const root = repo({
      ...PLAN,
      "docs/prd/components/PRD-tech-v1.md": componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`),
      "docs/prd/components/PRD-tech-v2.md": v2,
      "test/tech/x.test.ts": `// ${SPEC} TECH-3\n`,
    });
    const r = analyze(root);
    expect(r.errors.map((e: { msg: string }) => e.msg).join("\n")).toMatch(/TECH-1 \(P1\) has no test/);
    expect(r.errors.map((e: { msg: string }) => e.msg).join("\n")).not.toMatch(/TECH-3/); // defined by the draft, not enforced yet
  });

  it("does not enforce coverage for draft PRDs", () => {
    const root = repo({ "docs/prd/components/PRD-tech-v1.md": componentPrd("draft", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`) });
    expect(analyze(root).errors).toEqual([]);
  });

  it("regenerates the coverage block and then detects hollow status", () => {
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan(["TECH-2"]).replace("status: draft", "status: approved"),
      "src/tech/revoke.ts": `// ${SPEC} TECH-1\n`,
      "test/tech/revoke.test.ts": `// ${SPEC} TECH-1\n`,
    });
    const cfg = loadConfig(root);
    write(root, cfg, analyze(root, cfg));
    expect(read(root, "docs/trace/coverage.md")).toMatch(/\| TECH-1 \| P1 \| test linked \|/);
    expect(read(root, "docs/test/test-plan-v1.md")).not.toMatch(/covered/);
    writeFileSync(join(root, "test/tech/revoke.test.ts"), "// no annotation\n");
    const msgs = analyze(root).errors.map((e: { msg: string }) => e.msg).join("\n");
    expect(msgs).toMatch(/hollow status/);
  });

  it("before build, an approved criterion with planned evidence passes and one without warns", () => {
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan([]) + "\n| Criterion | Planned test |\n| --- | --- |\n| TECH-1 | unit |\n",
    });
    const r = analyze(root);
    expect(r.errors).toEqual([]);
    expect(r.rows.find((x: { id: string }) => x.id === "TECH-1")?.status).toBe("planned");
    expect(r.rows.find((x: { id: string }) => x.id === "TECH-2")?.status).toBe("gap");
    expect(r.warnings.map((w: { msg: string }) => w.msg).join("\n")).toMatch(/TECH-2 has no planned evidence/);
  });

  it("once a milestone plan exists, a planned criterion without a test is an error", () => {
    const root = repo({
      ...PLAN,
      "docs/prd/components/PRD-tech-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan(["TECH-2"]) + "\n| TECH-1 | unit |\n",
    });
    expect(analyze(root).errors.map((e: { msg: string }) => e.msg).join("\n")).toMatch(/TECH-1 \(P1\) has no test.*milestone plan for tech/);
  });

  it("reads a JUnit report: passing, failing, and a failing test is an error", () => {
    const junit = `<testsuites><testsuite name="s">
<testcase classname="test/tech/revoke.test.ts" name="TECH &gt; TECH-1: allows"></testcase>
<testcase classname="test/tech/revoke.test.ts" name="TECH-2: denies"><failure message="x"/></testcase>
<testcase classname="t" name="TECH-3: skipped"><skipped/></testcase>
</testsuite></testsuites>`;
    expect(readJUnit(junit)).toEqual([
      { name: "test/tech/revoke.test.ts TECH > TECH-1: allows", passed: true },
      { name: "test/tech/revoke.test.ts TECH-2: denies", passed: false },
    ]);
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": prd,
      "test/tech/revoke.test.ts": `// ${SPEC} TECH-1, TECH-2\n`,
      "src/tech/revoke.ts": `// ${SPEC} TECH-1, TECH-2\n`,
      "reports/junit.xml": junit,
    });
    const r = analyzeTrace(root, loadConfig(root), { results: "reports/junit.xml" } as any);
    expect(r.rows.find((x: { id: string }) => x.id === "TECH-1")?.status).toBe("passing");
    expect(r.rows.find((x: { id: string }) => x.id === "TECH-2")?.status).toBe("failing");
    expect(r.errors.map((e: { msg: string }) => e.msg).join("\n")).toMatch(/TECH-2 has a failing test/);
  });

  it("records exceptions and drift as their own states", () => {
    const root = repo({
      ...PLAN,
      "docs/prd/components/PRD-tech-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan([]).replace("status: draft", "status: approved").replace("deferred: []", "deferred: []\nexcepted: [TECH-1]"),
      "docs/trace/index.yaml": "components:\n  tech:\n    status: AUDITED\n    drift: [TECH-2]\n",
    });
    const r = analyze(root);
    expect(r.rows.find((x: { id: string }) => x.id === "TECH-1")?.status).toBe("excepted");
    expect(r.rows.find((x: { id: string }) => x.id === "TECH-2")?.status).toBe("drifted");
    expect(r.errors).toEqual([]);
  });

  it("warns when a governing artifact was approved after the last audit", () => {
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": prd.replace("prefix: TECH", "prefix: TECH\napproved: 2026-05-01"),
      "docs/trace/index.yaml": "components:\n  tech:\n    status: AUDITED\n    audited: 2026-04-01\n",
    });
    expect(analyze(root).warnings.map((w: { msg: string }) => w.msg).join("\n")).toMatch(/PRD-tech-v1.md was approved after the last audit/);
  });

  it("counts deferrals and exceptions only from an approved test plan", () => {
    const root = repo({
      ...PLAN,
      "docs/prd/components/PRD-tech-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan(["TECH-2"]).replace("deferred: [TECH-2]", "deferred: [TECH-2]\nexcepted: [TECH-1]"),
    });
    const r = analyze(root);
    expect(r.errors.map((e: { msg: string }) => e.msg).join("\n")).toMatch(/TECH-1 \(P1\) has no test/);
    expect(r.warnings.map((w: { msg: string }) => w.msg).join("\n")).toMatch(/not counted until the owner approves the test plan/);
  });

  it("puts a component in build when its plan cites richer criterion IDs", () => {
    const rich = componentPrd("approved", `| AM-PRIV-001-AC1 | ${EARS} | TECH-FR-1 | P1 |`).replace("prefix: TECH", "prefix: AM");
    const root = repo({
      "docs/prd/components/PRD-am-v1.md": rich,
      "docs/lld/LLD-am-v1.md": doc("lld", "approved", "prefix: AM\n"),
      "docs/build/M1-plan-v1.md": doc("plan", "draft", "milestone: M1\n", "| M1-1 | AM-PRIV-001-AC1 |\n"),
    });
    const cfg = JSON.parse(CONFIG);
    cfg.ids = { criterionPattern: "^(?<prefix>AM)-[A-Z]+-\\d{3}-AC\\d+$" };
    cfg.components = { am: { prefix: "AM" } };
    writeFileSync(join(root, "sdd.config.json"), JSON.stringify(cfg));
    expect(analyze(root).errors.map((e: { msg: string }) => e.msg).join("\n")).toMatch(/AM-PRIV-001-AC1 \(P1\) has no test/);
    expect(gateDecide(root, "sdd-implement", ["M1"]).allow).toBe(true);
  });

  it("accepts a configured richer criterion ID form", () => {
    const rich = componentPrd("approved", `| AM-PRIV-001-AC1 | ${EARS} | TECH-FR-1 | P1 |`).replace("prefix: TECH", "prefix: AM");
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": rich,
      "test/tech/x.test.ts": `// ${SPEC} AM-PRIV-001-AC1\n`,
      "src/tech/x.ts": `// ${SPEC} AM-PRIV-001-AC1\n`,
    });
    const cfg = JSON.parse(CONFIG);
    cfg.ids = { criterionPattern: "^(?<prefix>[A-Z]{2,4})-[A-Z]+-\\d{3}-AC\\d+$" };
    cfg.components = { tech: { prefix: "AM" } };
    writeFileSync(join(root, "sdd.config.json"), JSON.stringify(cfg));
    const r = analyze(root);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x: { id: string; status: string }) => `${x.id}:${x.status}`)).toEqual(["AM-PRIV-001-AC1:test linked"]);
    writeFileSync(join(root, "sdd.config.json"), CONFIG);
    expect(analyze(root).errors.map((e: { msg: string }) => e.msg).join("\n")).toMatch(/reverse orphan/);
  });
});

describe("hooks", () => {
  it("reads the skill name from a Skill tool call or a typed slash command", () => {
    expect(skillFromEvent({ tool_name: "Skill", tool_input: { skill: "sdd-lld" } })).toBe("sdd-lld");
    expect(skillFromEvent({ tool_name: "Skill", tool_input: { command: "sdd-framework:sdd-tasks" } })).toBe("sdd-tasks");
    expect(skillFromEvent({ hook_event_name: "UserPromptSubmit", prompt: "/sdd-hld design it" })).toBe("sdd-hld");
    expect(skillFromEvent({ hook_event_name: "UserPromptSubmit", prompt: "please explain sdd-hld" })).toBeNull();
    expect(skillFromEvent({ tool_name: "Bash", tool_input: { command: "sdd-lld" } })).toBeNull();
    // an ungated skill whose arguments mention a gated one is not blocked
    expect(skillFromEvent({ tool_name: "Skill", tool_input: { skill: "sdd-verify", args: "after sdd-implement" } })).toBe("sdd-verify");
  });

  it("reads the component and milestone that come with the skill", () => {
    expect(argsFromEvent({ tool_name: "Skill", tool_input: { skill: "sdd-lld", args: "tech" } })).toEqual(["tech"]);
    expect(argsFromEvent({ tool_name: "Skill", tool_input: { skill: "sdd-implement M2 billing" } })).toEqual(["M2", "billing"]);
    expect(argsFromEvent({ hook_event_name: "UserPromptSubmit", prompt: "/sdd-tasks TECH please" })).toEqual(["TECH", "please"]);
    expect(argsFromEvent({ hook_event_name: "UserPromptSubmit", prompt: "/sdd-lld tech\nleave billing alone" })).toEqual(["tech"]);
  });

  it("binds each gate to the component being advanced", () => {
    const two = JSON.parse(CONFIG);
    two.components = { tech: { prefix: "TECH" }, billing: { prefix: "BILL" } };
    const root = repo({
      "docs/spec/SPEC-v1.md": doc("spec", "approved"),
      "docs/prd/components/PRD-tech-v1.md": componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`),
      "docs/prd/components/PRD-billing-v1.md": componentPrd("draft", "").replace("prefix: TECH", "prefix: BILL"),
      "docs/lld/LLD-tech-v1.md": doc("lld", "approved", "prefix: TECH\n"),
      "docs/lld/LLD-billing-v1.md": doc("lld", "draft", "prefix: BILL\n"),
      "docs/build/M1-plan-v1.md": doc("plan", "draft", "milestone: M1\n", "| M1-1 | TECH-1 |\n"),
      "docs/build/M2-plan-v1.md": doc("plan", "draft", "milestone: M2\ncomponents: [billing]\n"),
    });
    writeFileSync(join(root, "sdd.config.json"), JSON.stringify(two));
    expect(gateDecide(root, "sdd-lld", ["tech"]).allow).toBe(true);
    expect(gateDecide(root, "sdd-lld", ["billing"]).allow).toBe(false); // its PRD is a draft
    expect((gateDecide(root, "sdd-lld", []) as any).reason).toMatch(/Name it/);
    expect(gateDecide(root, "sdd-tasks", ["TECH"]).allow).toBe(true);
    expect(gateDecide(root, "sdd-tasks", ["BILL"]).allow).toBe(false); // an approved TECH LLD does not open billing
    expect(gateDecide(root, "sdd-implement", ["M1"]).allow).toBe(true);
    expect((gateDecide(root, "sdd-implement", ["M2"]) as any).reason).toMatch(/builds billing, and the billing LLD is not approved/);
    expect(gateDecide(root, "sdd-implement", []).allow).toBe(false); // M2 is open and not ready
    expect(gateDecide(root, "sdd-lld", ["tech", "then", "leave", "billing", "alone"]).allow).toBe(true); // only the leading words name components
  });

  it("blocks a skill until its gate has passed", () => {
    const root = repo({ "docs/prd/components/PRD-tech-v1.md": componentPrd("draft", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`) });
    expect(gateDecide(root, "sdd-hld").allow).toBe(false);
    expect(gateDecide(root, "sdd-spec").allow).toBe(true);
    writeFileSync(join(root, "docs/prd/components/PRD-tech-v1.md"), componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`));
    expect(gateDecide(root, "sdd-hld").allow).toBe(true);
    expect(gateDecide(root, "sdd-lld").allow).toBe(false); // no approved SPEC yet
    writeFiles(root, { "docs/spec/SPEC-v1.md": doc("spec", "approved") });
    expect(gateDecide(root, "sdd-lld").allow).toBe(true); // one component configured, so it is implied
    expect(gateDecide(root, "sdd-implement").allow).toBe(false); // no plan yet
  });

  it("can be switched off with a feature flag", () => {
    const root = repo({});
    writeFileSync(join(root, "sdd.config.json"), JSON.stringify({ features: { gateHook: false, protectApprovedDocs: false } }));
    expect(gateDecide(root, "sdd-lld").allow).toBe(true);
  });

  it("protects approved documents from edits but not drafts or derived files", () => {
    const root = repo({
      "docs/prd/components/PRD-tech-v1.md": componentPrd("approved", `| TECH-1 | ${EARS} | TECH-FR-1 | P1 |`),
      "docs/prd/components/PRD-draft-v1.md": componentPrd("draft", ""),
      "docs/trace/index.yaml": "components:\n",
    });
    expect(protectDecide(root, "docs/prd/components/PRD-tech-v1.md").allow).toBe(false);
    expect(protectDecide(root, "docs/prd/components/PRD-draft-v1.md").allow).toBe(true);
    expect(protectDecide(root, "docs/trace/index.yaml").allow).toBe(true);
    expect(protectDecide(root, "src/x.ts").allow).toBe(true);
  });
});
