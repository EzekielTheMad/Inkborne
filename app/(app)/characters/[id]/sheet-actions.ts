"use server";

import { refresh, revalidatePath } from "next/cache";
import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";
import { basicSheetCommandsEnabled } from "@/lib/character/creation-ui-server";
import { boundedClassRoleJson } from "@/lib/character/class-role-effects-schema";
import { canonicalHitDieJson } from "@/lib/character/durable-hit-die-canonical";
import { basicSheetResponseSchema, manualHpRequestSchema, campaignAssignmentRequestSchema,
  type BasicSheetResponse } from "@/lib/character/basic-sheet-command";
import { createClient } from "@/lib/supabase/server";

/** Two finite commands; no replay, legacy fallback or user-supplied authority. */
async function execute(expectedActor: string, request: unknown, kind: "hp" | "campaign"): Promise<BasicSheetResponse> {
  const parsed = kind === "hp" ? manualHpRequestSchema.safeParse(request) : campaignAssignmentRequestSchema.safeParse(request);
  if (!basicSheetCommandsEnabled() || !boundedClassRoleJson(request) || !parsed.success) return { status: "invalid" };
  const verified = await resolveCharacterCommandContext();
  if (verified.status !== "token_verified" || verified.context.actor_id !== expectedActor) return { status: "unavailable" };
  try {
    const client = await createClient();
    const result = await client.rpc(kind === "hp" ? "character_manual_hp_command_v1" : "character_campaign_assignment_v1", {
      p_context: { ...verified.context }, p_request: parsed.data,
    });
    if (result.error || !boundedClassRoleJson(result.data)) return { status: "unknown" };
    const response = basicSheetResponseSchema.safeParse(result.data);
    if (!response.success) return { status: "unknown" };
    if (response.data.status !== "applied" && response.data.status !== "unchanged") return response.data;
    const saved = response.data;
    if (saved.actor_id !== expectedActor || saved.character_id !== parsed.data.character_id) return { status: "unknown" };
    if ("expected_parent" in parsed.data) {
      const expected = parsed.data.expected_parent;
      const nextState = { ...expected.state, ...parsed.data.patch };
      const changed = canonicalHitDieJson(nextState) !== canonicalHitDieJson(expected.state);
      if (saved.status !== (changed ? "applied" : "unchanged")
        || BigInt(saved.revision) !== BigInt(expected.action_revision) + BigInt(changed ? 1 : 0)
        || saved.campaign_id !== expected.campaign_id
        || canonicalHitDieJson(saved.state) !== canonicalHitDieJson(nextState)) return { status: "unknown" };
    } else if (saved.status !== "applied" || saved.campaign_id !== parsed.data.campaign_id
      || BigInt(saved.revision) !== BigInt(parsed.data.expected_revision) + BigInt(1)) return { status: "unknown" };
    revalidatePath(`/characters/${saved.character_id}`);
    return saved;
  } catch { return { status: "unknown" }; }
}

export async function saveManualCharacterHp(expectedActor: string, request: unknown): Promise<BasicSheetResponse> {
  const result = await execute(expectedActor, request, "hp");
  if (result.status === "applied") refresh();
  return result;
}

export async function assignNativeCharacterCampaign(expectedActor: string, request: unknown): Promise<BasicSheetResponse> {
  return execute(expectedActor, request, "campaign");
}
