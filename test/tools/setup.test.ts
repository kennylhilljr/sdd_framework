// Tests for `sdd init` (new repositories) and `sdd adopt` (existing repositories).
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { walk, rel } from "../../tools/lib/sdd-lib.mjs";
import { planInit, runInit } from "../../tools/sdd/init.mjs";
import { analyzeRepo, planAdopt, runAdopt, missingInformation } from "../../tools/sdd/adopt.mjs";
import { lint } from "../../tools/spec-lint/spec-lint.mjs";
import { analyze } from "../../tools/trace-check/trace-check.mjs";
import { newDoc, nextDoc, writeDocmap } from "../../tools/sdd/docs.mjs";
import { runUpgrade } from "../../tools/sdd/upgrade.mjs";
import { writeFileSync } from "node:fs";
import { tempDir, writeFiles, read, snapshot, isFile } from "./helpers.js";

const quiet = () => {};

describe("sdd init", () => {
  it("creates a working framework in an empty folder", () => {
    const dir = tempDir("init");
    expect(runInit(dir, { components: "tech:TECH" }, quiet)).toBe(0);
    for (const f of ["AGENTS.md", "CLAUDE.md", "sdd.config.json", ".claude/settings.json", "docs/README.md", "docs/test/test-plan-v1.md",
      "docs/trace/index.yaml", "tools/spec-lint/spec-lint.mjs", "tools/trace-check/trace-check.mjs", "tools/hooks/gate.mjs",
      ".claude/skills/sdd-intake/SKILL.md", ".claude/agents/verifier.md", "docs/templates/PRD-component-template.md",
      ".github/workflows/ci.yml", "package.json"])
      expect(isFile(dir, f), f).toBe(true);
    expect(existsSync(join(dir, "docs/prd/components/.gitkeep"))).toBe(true);
    expect(JSON.parse(read(dir, "sdd.config.json")).components.tech.prefix).toBe("TECH");
    expect(lint(dir).errors).toEqual([]);
    expect(analyze(dir).errors).toEqual([]);
  });

  it("installs files whose relative links all resolve, and a scope map that passes lint", () => {
    const dir = tempDir("init-links");
    runInit(dir, { components: "tech:TECH" }, quiet);
    const broken: string[] = [];
    for (const f of walk(dir, { exts: [".md"] } as any) as string[]) {
      const r = rel(dir, f);
      if (r.startsWith("tools/sdd/scaffold/")) continue; // source files: their links resolve where they are installed
      const text = readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
      for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1].split("#")[0];
        if (!target || /^(https?:|mailto:)/.test(target)) continue;
        if (!existsSync(resolve(dirname(f), decodeURIComponent(target)))) broken.push(`${r} -> ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
    for (const f of ["docs/scope/scope-map.yaml", "docs/adr/README.md", ".github/CODEOWNERS"]) expect(isFile(dir, f), f).toBe(true);
    expect(read(dir, ".github/CODEOWNERS").split("\n").every((l) => !l.trim() || l.startsWith("#"))).toBe(true); // inert until filled in
    expect(read(dir, "docs/README.md")).not.toMatch(/\bL[4-6]\b/);
    expect(writeDocmap(dir, { check: true })).toBe(true); // CI's doc map check passes on the first run
  });

  it("refuses a folder that already has files, unless forced", () => {
    const dir = tempDir("init-busy");
    writeFiles(dir, { "README.md": "# app\n" });
    expect(runInit(dir, {}, quiet)).toBe(1);
  });

  it("plans without writing in a dry run", () => {
    const dir = tempDir("init-dry");
    expect(runInit(dir, { dryRun: true }, quiet)).toBe(0);
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
    expect(planInit(dir).summary().create.length).toBeGreaterThan(50);
  });

  it("creates documents from templates and next versions of frozen documents", () => {
    const dir = tempDir("init-new");
    runInit(dir, {}, quiet);
    const p = newDoc(dir, "prd-component", { component: "tech", prefix: "TECH" });
    expect(p).toBe("docs/prd/components/PRD-tech-v1.md");
    const text = read(dir, p);
    expect(text).toMatch(/prefix: TECH/);
    expect(text).not.toMatch(/\{\{[A-Z_]+\}\}/);
    const adr = newDoc(dir, "adr", { name: "use-postgres" });
    expect(adr).toBe("docs/adr/0001-use-postgres.md");
    const next = nextDoc(dir, p);
    expect(next).toBe("docs/prd/components/PRD-tech-v2.md");
    expect(read(dir, next)).toMatch(/version: 2/);
    expect(read(dir, next)).toMatch(/supersedes: docs\/prd\/components\/PRD-tech-v1.md/);
  });
});

function brownfield() {
  const dir = tempDir("adopt");
  writeFiles(dir, {
    "package.json": JSON.stringify({ name: "shop-api", description: "Order API", scripts: { test: "jest", build: "tsc", start: "node dist/index.js" }, dependencies: { express: "^4", pg: "^8" }, devDependencies: { jest: "^29" } }),
    "README.md": "# Shop API\n\nThe Shop API takes orders from the storefront and keeps inventory in sync with the warehouse system.\n",
    "AGENTS.md": "# Existing agent rules\nUse tabs.\n",
    "CLAUDE.md": "Be careful.\n",
    ".claude/settings.json": JSON.stringify({ permissions: { allow: ["Bash(npm test)"] } }),
    ".github/workflows/ci.yml": "name: ci\non: push\njobs: {}\n",
    "src/orders/create-order.ts": "export function createOrder() { return 1; }\n",
    "src/orders/cancel-order.ts": "export async function cancelOrder() { return 2; }\n",
    "src/inventory/reserve.ts": "export class Reservation {}\n",
    "src/inventory/release.ts": "export const release = () => 0;\n",
    "test/orders/create-order.test.ts": "test('x', () => {});\n",
    "migrations/001_init.sql": "create table orders (id int);\n",
    "docs/adr/0001-use-express.md": "# Use Express\n",
    "openapi.yaml": "openapi: 3.1.0\n",
    "Dockerfile": "FROM node:20\n",
    "tsconfig.json": JSON.stringify({ compilerOptions: { allowJs: true, checkJs: true } }),
    "docs/README.md": "# Shop docs\n",
  });
  return dir;
}

describe("sdd adopt", () => {
  it("analyzes an existing repository", () => {
    const a: any = analyzeRepo(brownfield());
    expect(a.languages.TypeScript).toBe(5);
    expect(a.frameworks).toContain("Express");
    expect(a.testFrameworks).toContain("Jest");
    expect(a.integrations).toContain("PostgreSQL");
    expect(a.components.map((c: { name: string }) => c.name).sort()).toEqual(["inventory", "orders"]);
    expect(a.apiSpecs).toContain("openapi.yaml");
    const m: any = missingInformation(a);
    expect(m.seed).toHaveLength(12);
    expect(m.seed.find((s: unknown[]) => s[0] === 5)[3]).toBe("Missing");
  });

  it("writes nothing in a dry run", () => {
    const dir = brownfield();
    const before = snapshot(dir);
    expect(runAdopt(dir, {}, quiet)).toBe(0);
    expect(snapshot(dir)).toEqual(before);
  });

  it("never changes or deletes an existing file when applied", () => {
    const dir = brownfield();
    const before = snapshot(dir);
    expect(runAdopt(dir, { apply: true }, quiet)).toBe(0);
    const after = snapshot(dir);
    for (const [path, hash] of before) expect(after.get(path), path).toBe(hash);
    // conflicts become proposals beside the originals
    expect(isFile(dir, ".sdd-proposed/AGENTS.md")).toBe(true);
    expect(isFile(dir, ".sdd-proposed/CLAUDE.md")).toBe(true);
    expect(isFile(dir, ".sdd-proposed/.claude/settings.json")).toBe(true);
    // an existing docs/README.md stays the application's; the doc map goes beside it
    expect(isFile(dir, "docs/DOCMAP.md")).toBe(true);
    expect(JSON.parse(read(dir, "sdd.config.json")).paths.docMap).toBe("docs/DOCMAP.md");
    // host tooling configs are listed for the owner, never edited
    expect(read(dir, "docs/adoption/missing-information-v1.md")).toMatch(/tsconfig\.json/);
    // new material
    for (const f of ["docs/adoption/inventory-v1.md", "docs/adoption/missing-information-v1.md", "docs/prd/components/PRD-orders-v1.md",
      "docs/lld/LLD-inventory-v1.md", "docs/spec/SPEC-v1.md", ".github/workflows/sdd.yml", "sdd.config.json", "tools/sdd/cli.mjs"])
      expect(isFile(dir, f), f).toBe(true);
    expect(read(dir, "docs/adoption/missing-information-v1.md")).toMatch(/What must never happen\?/);
    expect(JSON.parse(read(dir, "sdd.config.json")).adoption.mode).toBe("advisory");
    // the adopted repository passes spec-lint (everything is a draft) and trace-check finds nothing to enforce yet
    expect(lint(dir).errors).toEqual([]);
    expect(analyze(dir).errors).toEqual([]);
  });

  it("refuses to adopt twice and points to upgrade", () => {
    const dir = brownfield();
    runAdopt(dir, { apply: true }, quiet);
    const once = snapshot(dir);
    const out: string[] = [];
    expect(runAdopt(dir, { apply: true }, (l: string) => out.push(l))).toBe(1);
    expect(out.join("\n")).toMatch(/sdd upgrade/);
    expect(snapshot(dir)).toEqual(once);
  });
});

describe("sdd upgrade", () => {
  it("adds missing framework files, proposes changed ones and never touches project files", () => {
    const dir = tempDir("upgrade");
    runInit(dir, { components: "tech:TECH" }, quiet);
    writeFileSync(join(dir, ".claude/skills/sdd-verify/SKILL.md"), "customized\n");
    writeFileSync(join(dir, "AGENTS.md"), "# my rules\n");
    const before = snapshot(dir);
    expect(runUpgrade(dir, {}, quiet)).toBe(0); // dry run
    expect(snapshot(dir)).toEqual(before);
    expect(runUpgrade(dir, { apply: true }, quiet)).toBe(0);
    expect(read(dir, ".claude/skills/sdd-verify/SKILL.md")).toBe("customized\n");
    expect(isFile(dir, ".sdd-proposed/.claude/skills/sdd-verify/SKILL.md")).toBe(true);
    expect(read(dir, "AGENTS.md")).toBe("# my rules\n");
    expect(runUpgrade(dir, { apply: true, overwrite: true }, quiet)).toBe(0);
    expect(read(dir, ".claude/skills/sdd-verify/SKILL.md")).not.toBe("customized\n");
    expect(read(dir, "AGENTS.md")).toBe("# my rules\n");
  });

  it("refuses a repository that does not use the framework", () => {
    expect(runUpgrade(tempDir("upgrade-none"), {}, quiet)).toBe(1);
  });
});
