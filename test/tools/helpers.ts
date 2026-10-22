import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { createHash } from "node:crypto";

export function tempDir(name: string): string {
  return mkdtempSync(join(tmpdir(), `sdd-${name}-`));
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

export function read(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

// Hash every file under root, so a test can prove nothing existing was changed.
export function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(relative(root, p), createHash("sha256").update(readFileSync(p)).digest("hex"));
    }
  };
  walk(root);
  return out;
}

export function isFile(root: string, path: string): boolean {
  try {
    return statSync(join(root, path)).isFile();
  } catch {
    return false;
  }
}

export const CONFIG = JSON.stringify({
  paths: { docs: "docs", codeRoots: ["src"], testRoots: ["test"], testPlan: "docs/test/test-plan-v1.md", traceIndex: "docs/trace/index.yaml" },
  components: { tech: { prefix: "TECH", paths: ["src/tech"] } },
  features: { reachReport: false },
});

export function componentPrd(status: string, rows: string): string {
  return `---
title: "TECH"
type: prd-component
version: 1
status: ${status}
owner: "Test Owner"
prefix: TECH
---

# Component PRD: TECH (v1)

## Acceptance criteria

| ID | Criterion | Requirement | Priority |
| --- | --- | --- | --- |
${rows}
`;
}

export function testPlan(deferred: string[] = []): string {
  return `---
title: "Test plan"
type: test-plan
version: 1
status: draft
owner: "Test Owner"
deferred: [${deferred.join(", ")}]
---

# Test plan (v1)
`;
}

// Any versioned document: front matter with the given type and status, extra front matter lines, and a body.
export function doc(type: string, status: string, extra = "", body = ""): string {
  return `---
title: "${type}"
type: ${type}
version: 1
status: ${status}
owner: "Test Owner"
${extra}---

# ${type} (v1)

${body}`;
}
