// Tests for the shared library, spec-lint, trace-check and the hooks.
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyId, parseYaml, parseTables, parseFrontMatter, loadConfig, parseArgs } from "../../tools/lib/sdd-lib.mjs";
import { lint } from "../../tools/spec-lint/spec-lint.mjs";
import { analyze, write } from "../../tools/trace-check/trace-check.mjs";
import { decide as gateDecide, skillFromEvent } from "../../tools/hooks/gate.mjs";
import { decide as protectDecide } from "../../tools/hooks/protect-approved.mjs";
import { tempDir, writeFiles, read, CONFIG, componentPrd, testPlan } from "./helpers.js";

const SPEC = "@" + "spec"; // built at runtime so trace-check does not read fixtures as real annotations
const EARS = "When a role is revoked, the system shall invalidate cached grants.";

describe("library", () => {
  it("classifies requirement IDs", () => {
    expect(classifyId("IAM-2")).toMatchObject({ kind: "criterion", prefix: "IAM" });
    expect(classifyId("**IAM-US-1**")).toMatchObject({ kind: "us", prefix: "IAM" });
    expect(classifyId("FR-3")).toMatchObject({ kind: "parent-fr" });
    expect(classifyId("NFR-1")).toMatchObject({ kind: "parent-nfr" });
    expect(classifyId("hello")).toBeNull();
  });

  it("parses the YAML subset used by front matter and the trace index", () => {
    const y: any = parseYaml("# comment\ncomponents:\n  iam:\n    status: AUDITED\n    audited_sha: null\n    next: \"Write: tests\" # trailing\nlist: [IAM-1, IAM-2]\n");
    expect(y.components.iam.status).toBe("AUDITED");
    expect(y.components.iam.audited_sha).toBeNull();
    expect(y.components.iam.next).toBe("Write: tests");
    expect(y.list).toEqual(["IAM-1", "IAM-2"]);
  });

  it("parses front matter with nested metadata", () => {
    const fm: any = parseFrontMatter("---\nname: x\nmetadata:\n  version: 1.2.3\n---\nbody\n");
    expect(fm.data.metadata.version).toBe("1.2.3");
    expect(fm.body).toBe("body\n");
  });

  it("never lets a boolean flag swallow the folder argument", () => {
    const a: any = parseArgs(["init", "--git", "../app", "--components", "iam:IAM"]);
    expect(a._).toEqual(["init", "../app"]);
    expect(a.git).toBe(true);
    expect(a.components).toBe("iam:IAM");
  });

  it("parses markdown tables and keeps line numbers", () => {
    const t: any = parseTables("text\n\n| ID | Criterion |\n| --- | --- |\n| IAM-1 | a \\| b |\n", 10);
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
    const root = repo({ "docs/prd/components/PRD-iam-v1.md": componentPrd("approved", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |`) });
    expect(lint(root).errors).toEqual([]);
  });

  it("rejects criteria that are not EARS or lack a priority, in approved documents", () => {
    const root = repo({ "docs/prd/components/PRD-iam-v1.md": componentPrd("approved", "| IAM-1 | Revocation is fast. | IAM-FR-1 | |") });
    const msgs = lint(root).errors.map((e) => e.msg).join("\n");
    expect(msgs).toMatch(/not in EARS form/);
    expect(msgs).toMatch(/needs a Priority/);
  });

  it("only warns about the same problems in drafts", () => {
    const root = repo({ "docs/prd/components/PRD-iam-v1.md": componentPrd("draft", "| IAM-1 | Revocation is fast. | IAM-FR-1 | |") });
    const r = lint(root);
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("rejects open questions, placeholders and version mismatches", () => {
    const doc = componentPrd("approved", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |`).replace("version: 1", "version: 2") + "\n- [ ] Q: who owns this?\nOwner: [Name]\n";
    const root = repo({ "docs/prd/components/PRD-iam-v1.md": doc });
    const msgs = lint(root).errors.map((e) => e.msg).join("\n");
    expect(msgs).toMatch(/open questions/);
    expect(msgs).toMatch(/placeholder/);
    expect(msgs).toMatch(/does not match file name/);
  });

  it("rejects duplicate IDs and IDs outside the component prefix", () => {
    const root = repo({
      "docs/prd/components/PRD-iam-v1.md": componentPrd("approved", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |\n| BILL-1 | ${EARS} | IAM-FR-1 | P1 |`),
      "docs/prd/components/PRD-other-v1.md": componentPrd("draft", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |`),
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

  it("requires a changelog entry on commands too", () => {
    const root = repo({ ".claude/commands/x.md": "---\ndescription: d\nmetadata:\n  version: 1.0.0\n---\nbody\n" });
    expect(lint(root).errors.map((e) => e.msg).join("\n")).toMatch(/Changelog/);
  });
});

describe("trace-check", () => {
  const prd = componentPrd("approved", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |\n| IAM-2 | ${EARS} | IAM-FR-1 | P3 |`);

  it("passes when every approved criterion is tested or deferred", () => {
    const root = repo({
      "docs/prd/components/PRD-iam-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan(["IAM-2"]),
      "src/iam/revoke.ts": `// ${SPEC} IAM-1\nexport const revoke = () => 1;\n`,
      "test/iam/revoke.test.ts": `// ${SPEC} IAM-1\n`,
    });
    const r = analyze(root);
    expect(r.errors).toEqual([]);
    expect(r.rows.find((x: { id: string }) => x.id === "IAM-2")?.status).toBe("deferred");
  });

  it("fails on an untested criterion, a reverse orphan and a deferred P1", () => {
    const root = repo({
      "docs/prd/components/PRD-iam-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan(["IAM-1"]),
      "test/iam/revoke.test.ts": `// ${SPEC} IAM-9\n`,
    });
    const msgs = analyze(root).errors.map((e: { msg: string }) => e.msg).join("\n");
    expect(msgs).toMatch(/IAM-9 cites an ID that no PRD defines/);
    expect(msgs).toMatch(/IAM-1 is P1 and cannot be deferred/);
    expect(msgs).toMatch(/IAM-2 \(P3\) has no test/);
  });

  it("keeps enforcing the approved version while a newer draft is written", () => {
    const v2 = componentPrd("draft", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |\n| IAM-3 | ${EARS} | IAM-FR-1 | P1 |`).replace("version: 1", "version: 2");
    const root = repo({
      "docs/prd/components/PRD-iam-v1.md": componentPrd("approved", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |`),
      "docs/prd/components/PRD-iam-v2.md": v2,
      "test/iam/x.test.ts": `// ${SPEC} IAM-3\n`,
    });
    const r = analyze(root);
    expect(r.errors.map((e: { msg: string }) => e.msg).join("\n")).toMatch(/IAM-1 \(P1\) has no test/);
    expect(r.errors.map((e: { msg: string }) => e.msg).join("\n")).not.toMatch(/IAM-3/); // defined by the draft, not enforced yet
  });

  it("does not enforce coverage for draft PRDs", () => {
    const root = repo({ "docs/prd/components/PRD-iam-v1.md": componentPrd("draft", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |`) });
    expect(analyze(root).errors).toEqual([]);
  });

  it("regenerates the coverage block and then detects hollow status", () => {
    const root = repo({
      "docs/prd/components/PRD-iam-v1.md": prd,
      "docs/test/test-plan-v1.md": testPlan(["IAM-2"]),
      "src/iam/revoke.ts": `// ${SPEC} IAM-1\n`,
      "test/iam/revoke.test.ts": `// ${SPEC} IAM-1\n`,
    });
    const cfg = loadConfig(root);
    write(root, cfg, analyze(root, cfg));
    expect(read(root, "docs/trace/coverage.md")).toMatch(/\| IAM-1 \| P1 \| covered \|/);
    expect(read(root, "docs/test/test-plan-v1.md")).not.toMatch(/covered/);
    writeFileSync(join(root, "test/iam/revoke.test.ts"), "// no annotation\n");
    const msgs = analyze(root).errors.map((e: { msg: string }) => e.msg).join("\n");
    expect(msgs).toMatch(/hollow status/);
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

  it("blocks a skill until its gate has passed", () => {
    const root = repo({ "docs/prd/components/PRD-iam-v1.md": componentPrd("draft", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |`) });
    expect(gateDecide(root, "sdd-hld").allow).toBe(false);
    expect(gateDecide(root, "sdd-spec").allow).toBe(true);
    writeFileSync(join(root, "docs/prd/components/PRD-iam-v1.md"), componentPrd("approved", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |`));
    expect(gateDecide(root, "sdd-hld").allow).toBe(true);
    expect(gateDecide(root, "sdd-lld").allow).toBe(false);
  });

  it("can be switched off with a feature flag", () => {
    const root = repo({});
    writeFileSync(join(root, "sdd.config.json"), JSON.stringify({ features: { gateHook: false, protectApprovedDocs: false } }));
    expect(gateDecide(root, "sdd-lld").allow).toBe(true);
  });

  it("protects approved documents from edits but not drafts or derived files", () => {
    const root = repo({
      "docs/prd/components/PRD-iam-v1.md": componentPrd("approved", `| IAM-1 | ${EARS} | IAM-FR-1 | P1 |`),
      "docs/prd/components/PRD-draft-v1.md": componentPrd("draft", ""),
      "docs/trace/index.yaml": "components:\n",
    });
    expect(protectDecide(root, "docs/prd/components/PRD-iam-v1.md").allow).toBe(false);
    expect(protectDecide(root, "docs/prd/components/PRD-draft-v1.md").allow).toBe(true);
    expect(protectDecide(root, "docs/trace/index.yaml").allow).toBe(true);
    expect(protectDecide(root, "src/x.ts").allow).toBe(true);
  });
});
