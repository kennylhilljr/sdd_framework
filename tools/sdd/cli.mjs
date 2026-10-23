#!/usr/bin/env node
// @ts-nocheck: plain JavaScript, kept out of the host project's type check
// sdd: the framework's command line. Node 20 or later, no dependencies.
//
//   node tools/sdd/cli.mjs <command> [options]
//
// Commands:
//   init [DIR]      set up the framework in a new repository        --name --components tech:TECH,billing:BILL --git --dry-run --force
//   adopt [DIR]     analyze an existing repository and add the framework without changing anything that exists
//                   (dry run by default)                             --apply --allow-dirty --json
//   upgrade [DIR]   bring a newer framework release into a repository (dry run by default)
//                                                                    --apply --overwrite --allow-dirty
//   doctor [DIR]    check that the local environment can run the framework
//   check           run spec-lint and trace-check                    --advisory --base REF
//   new TYPE        create a document from its template              --component --prefix --name --milestone --title
//   new --next PATH create the next version of a frozen document
//   docmap          regenerate the doc map in docs/README.md         --check
//   catalog         regenerate docs/guide/catalog.md                 --check
//   version         print the framework version
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, findRoot, loadConfig, FRAMEWORK_VERSION, isMain, loadAutoAcceptedDocs, AUTO_ACCEPT_FIELD, AUTO_ACCEPT_AT_FIELD, parseFrontMatter, toYaml } from "../lib/sdd-lib.mjs";
import { runInit } from "./init.mjs";
import { runAdopt } from "./adopt.mjs";
import { runDoctor } from "./doctor.mjs";
import { runUpgrade } from "./upgrade.mjs";
import { newDoc, nextDoc, writeDocmap, writeCatalog, DOC_TYPES } from "./docs.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));

function help() {
  const text = readHeader();
  console.log(text);
}
function readHeader() {
  return `sdd ${FRAMEWORK_VERSION}: spec-driven development framework\n\nUsage: node tools/sdd/cli.mjs <command> [options]\n\n` +
    "  init [DIR]        set up the framework in a new repository\n" +
    "  adopt [DIR]       analyze an existing repository; add --apply to write (never changes existing files)\n" +
    "  upgrade [DIR]     bring in a newer framework release; --apply writes, --overwrite replaces framework files\n" +
    "  doctor [DIR]      check the local environment\n" +
    "  check             run spec-lint and trace-check\n" +
    `  new TYPE          create a document from a template (${Object.keys(DOC_TYPES).join(", ")})\n` +
    "  new --next PATH   create the next version of a frozen document\n" +
    "  docmap            regenerate the doc map in docs/README.md\n" +
    "  catalog           regenerate docs/guide/catalog.md\n" +
    "  review-auto-accepted  list, confirm or revert auto-accepted documents\n" +
    "  version           print the framework version\n\nSee docs/guide/usage.md for details.";
}

function runNode(script, args) {
  const r = spawnSync(process.execPath, [join(HERE, "..", script), ...args], { stdio: "inherit" });
  return r.status ?? 1;
}

export function main(argv) {
  const args = parseArgs(argv);
  const [cmd, ...rest] = args._;
  if (args.help && cmd !== "new") {
    help();
    return 0;
  }
  try {
    switch (cmd) {
      case "init":
        return runInit(rest[0] || ".", { name: args.name, components: args.components, git: !!args.git, dryRun: !!args["dry-run"], force: !!args.force, owner: args.owner });
      case "adopt":
        return runAdopt(rest[0] || ".", { apply: !!args.apply, json: !!args.json, force: !!args.force, "allow-dirty": !!args["allow-dirty"] });
      case "upgrade":
        return runUpgrade(rest[0] || ".", { apply: !!args.apply, overwrite: !!args.overwrite, "allow-dirty": !!args["allow-dirty"] });
      case "doctor":
        return runDoctor(rest[0]);
      case "check": {
        const root = findRoot(process.cwd());
        const cfg = loadConfig(root);
        const advisory = args.advisory || cfg.adoption?.mode === "advisory" ? ["--advisory"] : [];
        const base = typeof args.base === "string" ? ["--base", args.base] : [];
        const a = runNode("spec-lint/spec-lint.mjs", ["--root", root, ...advisory]);
        const b = runNode("trace-check/trace-check.mjs", ["--root", root, ...advisory, ...base]);
        return a || b;
      }
      case "new": {
        if (args.help || (!rest[0] && !args.next)) {
          console.log(`Usage: node tools/sdd/cli.mjs new TYPE [options]   or   new --next PATH\n\nTypes: ${Object.keys(DOC_TYPES).join(", ")}\n` +
            "Options: --component NAME --prefix PFX (prd-component), --component (lld), --name SLUG (research, adr, runbook, postmortem),\n" +
            "         --milestone M1 (kickoff, plan, handoff), --title TEXT");
          return args.help ? 0 : 1;
        }
        const root = findRoot(process.cwd());
        const out = args.next ? nextDoc(root, String(args.next)) : newDoc(root, rest[0], args);
        console.log(`created ${out}`);
        writeDocmap(root);
        return 0;
      }
      case "docmap": {
        const root = findRoot(process.cwd());
        if (args.check) {
          const ok = writeDocmap(root, { check: true });
          console.log(ok ? "docmap is current" : "docs/README.md doc map is out of date; run: node tools/sdd/cli.mjs docmap");
          return ok ? 0 : 1;
        }
        writeDocmap(root);
        console.log("updated docs/README.md");
        return 0;
      }
      case "catalog": {
        const root = findRoot(process.cwd());
        if (args.check) {
          const ok = writeCatalog(root, { check: true });
          console.log(ok ? "catalog is current" : "docs/guide/catalog.md is out of date; run: node tools/sdd/cli.mjs catalog");
          return ok ? 0 : 1;
        }
        writeCatalog(root);
        console.log("updated docs/guide/catalog.md");
        return 0;
      }
      case "review-auto-accepted": {
        const root = findRoot(process.cwd());
        const cfg = loadConfig(root);
        const docs = loadAutoAcceptedDocs(root, cfg);
        if (args.json) {
          console.log(JSON.stringify(docs.map((d) => ({
            path: d.rel,
            status: d.data.status || null,
            auto_accepted_at: d.data[AUTO_ACCEPT_AT_FIELD] || null,
            human_reviewed: d.data.human_reviewed || false,
          })), null, 2));
          return 0;
        }
        if (args.revert) {
          const target = String(args.revert);
          const abs = resolve(root, target);
          if (!existsSync(abs)) { console.error(`sdd review-auto-accepted: ${target} not found`); return 1; }
          const { data, body } = parseFrontMatter(readFileSync(abs, "utf8"));
          delete data[AUTO_ACCEPT_FIELD];
          delete data[AUTO_ACCEPT_AT_FIELD];
          delete data.human_reviewed;
          delete data.human_reviewed_at;
          data.status = "draft";
          writeFileSync(abs, `---\n${toYaml(data)}---\n${body}`);
          console.log(`reverted ${target} to draft`);
          return 0;
        }
        if (!docs.length) {
          console.log("No auto-accepted documents found.");
          return 0;
        }
        const pad = (s, n) => String(s).padEnd(n);
        console.log(`\nAuto-accepted documents (${docs.length})\n${"─".repeat(74)}`);
        console.log(`${"Path".padEnd(46)} ${"Status".padEnd(10)} ${"Auto-accepted at".padEnd(22)} Reviewed`);
        for (const d of docs) {
          const at = d.data[AUTO_ACCEPT_AT_FIELD] || "(unknown)";
          const rev = d.data.human_reviewed ? "yes" : "no";
          console.log(`  ${pad(d.rel, 44)} ${pad(d.data.status || "", 10)} ${pad(at, 22)} ${rev}`);
        }
        console.log("");
        if (args.confirm) {
          const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
          for (const d of docs) {
            const { data, body } = parseFrontMatter(readFileSync(d.path, "utf8"));
            data.human_reviewed = true;
            data.human_reviewed_at = now;
            writeFileSync(d.path, `---\n${toYaml(data)}---\n${body}`);
          }
          console.log(`Marked ${docs.length} document(s) as human-reviewed.`);
          return 0;
        }
        console.log("Run with --confirm to mark all as human-reviewed.");
        console.log("Run with --revert <path> to reset a document to status: draft.");
        return 0;
      }
      case "version":
        console.log(FRAMEWORK_VERSION);
        return 0;
      default:
        help();
        return cmd ? 1 : 0;
    }
  } catch (e) {
    console.error(`sdd ${cmd}: ${e.message}`);
    return 1;
  }
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
