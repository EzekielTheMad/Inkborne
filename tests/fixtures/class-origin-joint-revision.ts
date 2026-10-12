import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { CLASS_ORIGIN_STAGE_PATH } from "@/lib/character/class-origin-command-model";
import { CLASS_ORIGIN_AUTHORITY_BASE, CLASS_ORIGIN_JOINT_STAGE_PATH, type ClassOriginJointSources } from "@/lib/character/class-origin-joint-revision-model";
import { classOriginTransitionFixture } from "./class-origin-command";
import { roleId } from "./class-role-effects";

/** Read-only frozen Git evidence: this worktree predates the R09 authority stage. */
export function classOriginJointSources(): ClassOriginJointSources {
  return {
    authority: execFileSync("git", ["show", `${CLASS_ORIGIN_AUTHORITY_BASE}:supabase/staged/hit-die-authority-and-writers.sql`], { encoding: "utf8", windowsHide: true }),
    p1a: readFileSync(CLASS_ORIGIN_STAGE_PATH, "utf8"), joint: readFileSync(CLASS_ORIGIN_JOINT_STAGE_PATH, "utf8"),
  };
}
/** Original current stored metadata injection, NOT actual DB/Auth acceptance. */
export function classOriginJointFixture(mode: "level1" | "higher" | "multiclass" = "level1") {
  const acceptance = classOriginTransitionFixture();
  if (acceptance.acceptance_kind !== "class_transition") throw Error("Original transition fixture required");
  acceptance.finalized = false; acceptance.revision_transition_consumed = false;
  acceptance.transitions.find(row => row.relation_key === "class_receipt")!.consumed = false;
  if (mode === "higher") {
    acceptance.before_parent.level = 7; acceptance.expected_graph.parent.level = 7;
    for (const parent of [acceptance.before_parent, acceptance.expected_graph.parent]) {
      (parent.choices as { classes: { level: number }[] }).classes[0].level = 7;
    }
  }
  if (mode === "multiclass") {
    const graph = acceptance.expected_graph, occurrence = structuredClone(graph.occurrences[0]);
    occurrence.id = roleId(970); occurrence.content_id = roleId(971); occurrence.controller_ref_id = roleId(972);
    occurrence.class_slug = "original-ash-sentinel"; occurrence.lifecycle = "provisional";
    occurrence.acquired_character_level = null; occurrence.acquisition_operation_id = null; occurrence.accepted_at = null;
    graph.occurrences.push(occurrence);
    graph.refs.push({ ...structuredClone(graph.refs[0]), id: occurrence.controller_ref_id, content_id: occurrence.content_id });
    graph.versions.push({ ...structuredClone(graph.versions[0]), content_id: occurrence.content_id, slug_snapshot: occurrence.class_slug, name_snapshot: "Original ash sentinel" });
    graph.order.pins.push(String(occurrence.controller_ref_id));
    for (const parent of [acceptance.before_parent, graph.parent]) {
      (parent.choices as { classes: { occurrence_id: string; slug: string; level: number }[] }).classes.push({ occurrence_id: String(occurrence.id), slug: String(occurrence.class_slug), level: 1 });
      parent.level = 2;
    }
  }
  const actualBefore = structuredClone(acceptance.expected_graph);
  actualBefore.parent = structuredClone(acceptance.before_parent); actualBefore.order.producer_revision = "0";
  return { acceptance, actualBefore };
}
