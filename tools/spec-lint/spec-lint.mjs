#!/usr/bin/env node
// @ts-nocheck: plain JavaScript, kept out of the host project's type check
// spec-lint: checks that the spec documents are well formed.
// Usage: node tools/spec-lint/spec-lint.mjs [--root DIR] [--json] [--advisory]
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  findRoot, loadConfig, loadDocs, collectDefinitions, parseTables, parseFrontMatter, readText, walk, rel,
  classifyId, cleanCell, docStatus, DOC_STATUSES, ADR_STATUSES, parseArgs, report, isMain } from "../lib/sdd-lib.mjs";

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const EARS_RE = /\bshall\b/i;
const OPEN_QUESTION_RE = /^\s*[-*]\s+\[ \]\s+Q:/m;
const PLACEHOLDER_RE = /\[PREFIX\]|\[Name\]|\[Link[^\]]*\]|\bTBD\b/;
const REQUIRED_KEYS = ["title", "type", "version", "status", "owner"];

export function lint(root, cfg = loadConfig(root)) {
  const errors = [];
  const warnings = [];
  const infos = [];
  const docs = loadDocs(root, cfg);

  // 1. Front matter on versioned documents and ADRs
  for (const d of docs) {
    if (!d.family && !d.isAdr) continue;
    if (!d.hasFrontMatter) {
      // ADRs written before adoption may use another format; report them without failing
      (d.isAdr ? warnings : errors).push({ file: d.rel, msg: d.isAdr ? "ADR has no front matter (title, status, owner); add it when the ADR is next superseded" : "missing front matter (title, type, version, status, owner)" });
      continue;
    }
    const keys = d.isAdr ? ["title", "status", "owner"] : REQUIRED_KEYS;
    for (const k of keys) if (d.data[k] === undefined || d.data[k] === "") errors.push({ file: d.rel, msg: `front matter is missing "${k}"` });
    if (d.family && d.data.version !== undefined && Number(d.data.version) !== d.fileVersion)
      errors.push({ file: d.rel, msg: `front matter version ${d.data.version} does not match file name v${d.fileVersion}` });
    const st = docStatus(d);
    if (d.isAdr) {
      if (st && !ADR_STATUSES.has(st)) errors.push({ file: d.rel, msg: `ADR status "${st}" is not one of ${[...ADR_STATUSES].join(", ")}` });
    } else if (st && !DOC_STATUSES.has(st)) {
      errors.push({ file: d.rel, msg: `status "${st}" is not one of ${[...DOC_STATUSES].join(", ")}` });
    }
    // 2. Approved documents are complete
    if (st === "approved" || st === "accepted") {
      if (OPEN_QUESTION_RE.test(d.body)) errors.push({ file: d.rel, msg: "approved document still has open questions (- [ ] Q:)" });
      const ph = PLACEHOLDER_RE.exec(d.body);
      if (ph) errors.push({ file: d.rel, msg: `approved document still contains the placeholder "${ph[0]}"` });
    }
  }

  // 3. ADR numbers are unique
  const adrNums = new Map();
  for (const d of docs.filter((x) => x.isAdr)) {
    const n = d.name.slice(0, 4);
    if (adrNums.has(n)) errors.push({ file: d.rel, msg: `ADR number ${n} is also used by ${adrNums.get(n)}` });
    else adrNums.set(n, d.rel);
  }

  // 4. Requirement definitions
  const { defs, duplicates } = collectDefinitions(docs);
  for (const dup of duplicates)
    errors.push({ file: dup.second.file, line: dup.second.line, msg: `${dup.id} is already defined in ${dup.first.file}:${dup.first.line}` });

  for (const d of docs) {
    if (!d.isLatest) continue;
    const type = String(d.data.type || "");
    if (type === "prd-component" && !d.data.prefix) errors.push({ file: d.rel, msg: 'component PRD front matter needs "prefix" (for example IAM)' });
  }

  for (const def of defs.values()) {
    if (def.docType === "prd-component" && def.prefix && def.docPrefix && def.prefix !== def.docPrefix)
      errors.push({ file: def.file, line: def.line, msg: `${def.id} does not use this component's prefix ${def.docPrefix}` });
    if (def.kind !== "criterion") continue;
    const enforce = def.docStatus === "approved";
    const push = (msg) => (enforce ? errors : warnings).push({ file: def.file, line: def.line, msg });
    if (!/^P[123]$/.test(def.priority)) push(`${def.id} needs a Priority of P1, P2 or P3`);
    if (def.notation === "gherkin") {
      if (!/\bGiven\b/.test(def.text) || !/\bThen\b/.test(def.text)) push(`${def.id} is not in Given/When/Then form`);
    } else if (!EARS_RE.test(def.text)) {
      push(`${def.id} is not in EARS form (expected "... shall ...")`);
    } else if (/\bshall\b.*\band\b.*\bshall\b/i.test(def.text)) {
      warnings.push({ file: def.file, line: def.line, msg: `${def.id} states more than one response; split it` });
    }
  }

  // 5. Component requirements that cite a parent must cite one that exists
  for (const d of docs.filter((x) => x.isLatest && x.data.type === "prd-component")) {
    for (const t of parseTables(d.body, d.bodyStart)) {
      if (!t.headers.includes("parent")) continue;
      for (const row of t.rows) {
        for (const p of cleanCell(row.parent).split(/[,\s]+/).filter(Boolean)) {
          if (/^(FR|NFR|OUT|INV)-\d+$/.test(p) && !defs.has(p))
            warnings.push({ file: d.rel, line: row._line, msg: `parent ${p} is not defined in the parent PRD` });
        }
      }
    }
  }

  // 6. Skills, agents and commands carry a version and a changelog entry for it
  const versioned = [];
  const skillsDir = join(root, ".claude", "skills");
  if (existsSync(skillsDir))
    for (const e of readdirSync(skillsDir, { withFileTypes: true }))
      if (e.isDirectory() && existsSync(join(skillsDir, e.name, "SKILL.md"))) versioned.push(join(skillsDir, e.name, "SKILL.md"));
  for (const f of walk(join(root, ".claude", "agents"), { exts: [".md"] })) versioned.push(f);
  for (const f of walk(join(root, ".claude", "commands"), { exts: [".md"] })) versioned.push(f);
  for (const f of versioned) {
    const r = rel(root, f);
    const fm = parseFrontMatter(readText(f) ?? "");
    const isCommand = r.includes("/commands/");
    if (!fm.hasFrontMatter) {
      errors.push({ file: r, msg: "missing front matter" });
      continue;
    }
    if (!isCommand && !fm.data.name) errors.push({ file: r, msg: 'front matter is missing "name"' });
    if (!fm.data.description) errors.push({ file: r, msg: 'front matter is missing "description"' });
    // version lives under metadata: (portable across Claude Code, claude.ai and the Skills API)
    const v = String(fm.data.metadata?.version ?? fm.data.version ?? "");
    if (!SEMVER_RE.test(v)) errors.push({ file: r, msg: `front matter "metadata.version" must be semver (found "${v}")` });
    else if (!new RegExp(`^##\\s+Changelog[\\s\\S]*?^[-*|]\\s*\\|?\\s*${v.replace(/\./g, "\\.")}\\b`, "m").test(fm.body))
      errors.push({ file: r, msg: `no "## Changelog" entry for version ${v}` });
  }

  // 7. Templates tag every section with an owner
  for (const f of walk(join(root, cfg.paths.docs, "templates"), { exts: [".md"] })) {
    const text = readText(f) ?? "";
    const sections = text.split(/^## /m).slice(1);
    sections.forEach((s) => {
      const title = s.split("\n")[0].trim();
      if (/^(how to use|appendix|approvals|gate)/i.test(title)) return;
      if (!/>\s*\*\*Owner:\*\*\s*(H|C|A)\b/.test(s))
        warnings.push({ file: rel(root, f), msg: `section "${title}" has no "> **Owner:** H|C|A" line` });
    });
  }

  infos.push({ msg: `${docs.length} documents, ${defs.size} requirement IDs, ${versioned.length} skills, agents and commands checked` });
  return { errors, warnings, infos };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = findRoot(args.root || process.cwd());
  try {
    process.exit(report("spec-lint", lint(root), { json: !!args.json, advisory: !!args.advisory }));
  } catch (e) {
    console.error(`spec-lint failed to run: ${e.message}`);
    process.exit(args.advisory ? 0 : 2);
  }
}
