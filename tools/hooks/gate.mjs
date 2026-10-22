#!/usr/bin/env node
// @ts-nocheck: plain JavaScript, kept out of the host project's type check
// Gate hook (Claude Code PreToolUse, matcher "Skill").
// Blocks a skill until the artifact it builds on has passed its human gate.
// Exit 2 blocks the tool call and shows the reason to the agent; every other path exits 0,
// so a broken hook can never break a session.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { findRoot, loadConfig, loadDocs, docStatus, isMain } from "../lib/sdd-lib.mjs";

// skill -> requirement on the documents it reads
export const GATES = {
  "sdd-hld": { gate: 1, types: ["prd", "prd-component"], need: "an approved PRD (Gate 1)" },
  "sdd-lld": { gate: 2, types: ["spec"], need: "an approved SPEC, the system HLD (Gate 2)" },
  "sdd-tasks": { gate: 3, types: ["lld"], need: "an approved LLD for the component (Gate 3)" },
  "sdd-implement": { gate: 3, types: ["plan"], need: "a milestone plan from sdd-tasks, with its LLD approved at Gate 3" },
};

export function decide(root, skillName) {
  const name = String(skillName || "").replace(/^.*:/, "");
  const rule = GATES[name];
  if (!rule) return { allow: true };
  const cfg = loadConfig(root);
  if (!cfg.features.gateHook) return { allow: true };
  const docs = loadDocs(root, cfg).filter((d) => d.isLatest && rule.types.includes(String(d.data.type || "")));
  const ok = docs.some((d) => (rule.types.includes("plan") ? docStatus(d) !== "superseded" : docStatus(d) === "approved"));
  if (ok) return { allow: true };
  return {
    allow: false,
    reason:
      `Gate ${rule.gate} is not passed: ${name} needs ${rule.need}. ` +
      `Ask the owner to review and set "status: approved" in the document's front matter, ` +
      `or turn the gate off with features.gateHook=false in sdd.config.json.`,
  };
}

// Find which skill an event refers to. Two events are handled:
//   PreToolUse with tool_name "Skill" (the agent invokes a skill): the skill name is read from
//   tool_input.skill, or name or command when a client uses another field; and
//   UserPromptSubmit (a person types /sdd-lld ...).
export function skillFromEvent(input) {
  if (!input || typeof input !== "object") return null;
  if (input.hook_event_name === "UserPromptSubmit" || typeof input.prompt === "string") {
    const m = /^\s*\/(?:[a-z0-9-]+:)?(sdd-[a-z-]+)\b/.exec(String(input.prompt || ""));
    return m ? m[1] : null;
  }
  if (input.tool_name !== "Skill") return null;
  const ti = input.tool_input || {};
  const field = [ti.skill, ti.name, ti.command].find((v) => typeof v === "string" && v.trim());
  if (!field) return null;
  // "sdd-framework:sdd-lld", "/sdd-lld", "sdd-lld some args" -> "sdd-lld"
  const first = field.trim().replace(/^\//, "").split(/\s+/)[0];
  return first.replace(/^.*:/, "") || null;
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0);
  }
  const skill = skillFromEvent(input);
  if (!skill) process.exit(0);
  const root = findRoot(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  const result = decide(root, skill);
  if (result.allow) process.exit(0);
  process.stderr.write(result.reason + "\n");
  process.exit(2);
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch {
    process.exit(0);
  }
}
