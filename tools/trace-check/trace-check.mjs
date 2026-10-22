#!/usr/bin/env node
// @ts-nocheck: plain JavaScript, kept out of the host project's type check
// trace-check: checks the links between requirements, tests and code.
// Usage: node tools/trace-check/trace-check.mjs [--root DIR] [--write] [--base REF] [--json] [--advisory]
//   --write     regenerate docs/trace/coverage.md and the coverage counts in the trace index
//   --base REF  report annotation reach for files changed since REF (for example origin/main)
import { join, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  findRoot, loadConfig, loadDocs, collectDefinitions, scanAnnotations, listSourceFiles, parseFrontMatter,
  parseYaml, toYaml, git, isGitRepo, parseArgs, report, readText, findTestPlan, isMain } from "../lib/sdd-lib.mjs";

export const COVERAGE_START = "<!-- trace-check:coverage:start -->";
export const COVERAGE_END = "<!-- trace-check:coverage:end -->";

export function analyze(root, cfg = loadConfig(root), { base = null } = {}) {
  const errors = [];
  const warnings = [];
  const infos = [];
  const docs = loadDocs(root, cfg);
  const { defs } = collectDefinitions(docs);
  const annotations = scanAnnotations(root, cfg);

  // Test plan: the deferred criteria (an owner decision recorded in its front matter)
  const planRel = findTestPlan(root, cfg, docs);
  const planText = readText(join(root, planRel));
  const plan = planText ? parseFrontMatter(planText) : { data: {}, body: "" };
  const deferred = new Set((Array.isArray(plan.data.deferred) ? plan.data.deferred : []).map(String));

  // Index annotations
  const testsFor = new Map();
  const codeFor = new Map();
  for (const a of annotations) {
    for (const id of a.ids) {
      const map = a.isTest ? testsFor : codeFor;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(`${a.file}:${a.line}`);
      // 1. Reverse orphans: an annotation cites an ID that nothing defines
      if (!defs.has(id)) errors.push({ file: a.file, line: a.line, msg: `@spec ${id} cites an ID that no PRD defines (reverse orphan)` });
      else if (defs.get(id).kind !== "criterion")
        warnings.push({ file: a.file, line: a.line, msg: `@spec ${id} cites a ${defs.get(id).kind} ID; cite acceptance criteria instead` });
    }
  }

  // 2. Coverage of acceptance criteria
  const rows = [];
  for (const def of defs.values()) {
    if (def.kind !== "criterion") continue;
    const tests = testsFor.get(def.id) || [];
    const code = codeFor.get(def.id) || [];
    const isDeferred = deferred.has(def.id);
    let status = tests.length ? "covered" : isDeferred ? "deferred" : "gap";
    if (isDeferred && def.priority === "P1")
      errors.push({ file: def.file, line: def.line, msg: `${def.id} is P1 and cannot be deferred` });
    if (def.docStatus !== "approved") {
      if (status === "gap") infos.push({ msg: `${def.id} has no test yet (its PRD is ${def.docStatus || "unversioned"}, so this is not enforced)` });
      if (status === "gap") status = "gap (draft)";
    } else if (!tests.length && !isDeferred) {
      errors.push({ file: def.file, line: def.line, msg: `${def.id} (${def.priority || "no priority"}) has no test citing it with @spec` });
    }
    if (tests.length && !code.length)
      warnings.push({ file: def.file, line: def.line, msg: `${def.id} has a test but no code entry point carries @spec ${def.id}` });
    rows.push({ id: def.id, priority: def.priority, status, tests, code, file: def.file });
  }
  for (const id of deferred) if (!defs.has(id)) warnings.push({ file: planRel, msg: `deferred ID ${id} is not defined` });

  // 3. Hollow status: the coverage report claims coverage that the annotations do not show
  const covText = readText(join(root, cfg.paths.coverage));
  if (covText && covText.includes(COVERAGE_START)) {
    const block = covText.slice(covText.indexOf(COVERAGE_START), covText.indexOf(COVERAGE_END));
    for (const line of block.split("\n")) {
      const m = /^\|\s*([A-Z][A-Z0-9-]*\d)\s*\|[^|]*\|\s*covered\s*\|/.exec(line);
      if (m && !(testsFor.get(m[1]) || []).length)
        errors.push({ file: cfg.paths.coverage, msg: `${m[1]} is marked covered but no test cites it (hollow status); run trace-check --write` });
    }
  }

  // 4. Staleness from the trace index
  const index = loadIndex(root, cfg);
  const now = Date.now();
  const gitOk = isGitRepo(root);
  for (const [name, comp] of Object.entries(index.components || {})) {
    const cfgComp = cfg.components[name] || {};
    if (comp.audited) {
      const days = (now - Date.parse(comp.audited)) / 86400000;
      if (days > cfg.trace.staleAfterDays) warnings.push({ file: cfg.paths.traceIndex, msg: `component ${name} was last audited ${Math.floor(days)} days ago` });
    } else warnings.push({ file: cfg.paths.traceIndex, msg: `component ${name} has never been audited` });
    if (gitOk && comp.audited_sha && (cfgComp.paths || []).length) {
      const changed = git(root, ["diff", "--name-only", `${comp.audited_sha}..HEAD`, "--", ...cfgComp.paths]);
      if (changed) warnings.push({ file: cfg.paths.traceIndex, msg: `component ${name} changed since its last audit (${changed.split("\n").length} file(s))` });
    }
  }

  // 5. Annotation reach (file level): changed source files that carry at least one @spec
  let reach = null;
  if (cfg.features.reachReport) {
    let files = listSourceFiles(root, cfg);
    if (base && gitOk) {
      const changed = git(root, ["diff", "--name-only", `${base}...HEAD`]);
      const set = new Set((changed || "").split("\n").filter(Boolean));
      files = files.filter((f) => set.has(f));
    }
    const annotated = new Set(annotations.filter((a) => !a.isTest).map((a) => a.file));
    const behavior = files.filter((f) => !/\.(d\.ts|md|json|ya?ml|lock|txt|css|svg|png)$/.test(f) && !/(^|\/)(index|types?)\.[a-z]+$/.test(f));
    if (behavior.length) {
      const hit = behavior.filter((f) => annotated.has(f)).length;
      reach = { files: behavior.length, annotated: hit, ratio: hit / behavior.length };
      const pct = Math.round(reach.ratio * 100);
      const msg = `annotation reach: ${hit} of ${behavior.length} ${base ? "changed " : ""}source file(s) carry @spec (${pct}%)`;
      if (reach.ratio < cfg.trace.reachWarnBelow) warnings.push({ msg });
      else infos.push({ msg });
    }
  }

  infos.push({ msg: `${rows.length} acceptance criteria, ${annotations.length} annotations` });
  return { errors, warnings, infos, rows, reach, index };
}

export function loadIndex(root, cfg) {
  const p = join(root, cfg.paths.traceIndex);
  if (!existsSync(p)) return { components: {} };
  return parseYaml(readFileSync(p, "utf8"));
}

export function coverageTable(rows) {
  const lines = [COVERAGE_START, "", "| ID | Priority | Status | Tests | Code entry points |", "| --- | --- | --- | --- | --- |"];
  for (const r of [...rows].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })))
    lines.push(`| ${r.id} | ${r.priority || ""} | ${r.status} | ${r.tests.join("<br>") || ""} | ${r.code.join("<br>") || ""} |`);
  lines.push("", `Generated by trace-check. Do not edit by hand.`, "", COVERAGE_END);
  return lines.join("\n");
}

export function write(root, cfg, result) {
  const written = [];
  const covPath = join(root, cfg.paths.coverage);
  const header =
    "# Coverage of acceptance criteria\n\n" +
    "Derived status: which approved criteria have tests and code entry points citing them with `@spec`. " +
    "Regenerated by `node tools/trace-check/trace-check.mjs --write`; never edit by hand. " +
    "Deferred criteria are listed in the test plan's front matter.\n\n";
  const next = header + coverageTable(result.rows) + "\n";
  if (readText(covPath) !== next) {
    mkdirSync(dirname(covPath), { recursive: true });
    writeFileSync(covPath, next);
    written.push(cfg.paths.coverage);
  }
  const idxPath = join(root, cfg.paths.traceIndex);
  if (existsSync(idxPath)) {
    const index = result.index || { components: {} };
    index.components = index.components || {};
    for (const [name, comp] of Object.entries(cfg.components)) {
      const mine = result.rows.filter((r) => r.id.startsWith(comp.prefix + "-"));
      const entry = (index.components[name] = index.components[name] || { status: "UNMAPPED" });
      entry.criteria = mine.length;
      entry.covered = mine.filter((r) => r.status === "covered").length;
      entry.deferred = mine.filter((r) => r.status === "deferred").length;
      entry.gaps = mine.filter((r) => r.status.startsWith("gap")).length;
    }
    const header = readFileSync(idxPath, "utf8").split("\n").filter((l) => l.startsWith("#")).join("\n");
    const next = (header ? header + "\n" : "") + toYaml(index);
    if (next !== readFileSync(idxPath, "utf8")) {
      writeFileSync(idxPath, next);
      written.push(cfg.paths.traceIndex);
    }
  }
  return written;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = findRoot(args.root || process.cwd());
  try {
    const cfg = loadConfig(root);
    const result = analyze(root, cfg, { base: typeof args.base === "string" ? args.base : null });
    if (args.write) {
      for (const w of write(root, cfg, result)) result.infos.push({ msg: `updated ${w}` });
      result.errors = result.errors.filter((e) => !e.msg.includes("hollow status"));
    }
    process.exit(report("trace-check", result, { json: !!args.json, advisory: !!args.advisory }));
  } catch (e) {
    console.error(`trace-check failed to run: ${e.message}`);
    process.exit(args.advisory ? 0 : 2);
  }
}
