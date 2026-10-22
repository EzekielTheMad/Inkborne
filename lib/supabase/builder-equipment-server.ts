import "server-only";
import { randomUUID } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";
import { createClient } from "./server";
import { getContentRefsByCharacter } from "./content-refs";
import { getContentByType } from "./content-definitions";
import { buildInventoryGrants, isSelectionComplete, parseEquipmentGroups } from "@/lib/builder/equipment-choices";
import { equipmentRequestIntent, equipmentSelectionsSchema, equipmentPlanSchema, equalEquipmentIntent,
  startingEquipmentResultSchema, type EquipmentRequest, type StartingEquipmentResult } from "@/lib/builder/starting-equipment-contract";
import type { Json } from "./database.types";

type EquipmentDatabase = { public: { Tables: Record<string, never>; Views: Record<string, never>;
  Functions: { commit_character_builder_equipment_v1: { Args: { p_context: Json; p_request: Json }; Returns: Json } };
  Enums: Record<string, never>; CompositeTypes: Record<string, never> } };

function reportRefusal(error: { code?: string; message?: string } | null) {
  const message = error?.message;
  console.warn("Equipment award was not confirmed", { code: error?.code ?? "response",
    reason: typeof message === "string" && (/^builder_[a-z_]+$/.test(message)
      || /^permission denied for (schema|table|function|sequence) [a-z0-9_.]+$/.test(message)
      || /^missing FROM-clause entry for table "[a-z0-9_]+"$/.test(message)) ? message : "withheld" });
}

/** The browser supplies selections and source identities, never an award plan. */
export async function confirmBuilderEquipment(request: EquipmentRequest): Promise<StartingEquipmentResult> {
  try {
    const verified = await resolveCharacterCommandContext();
    if (verified.status !== "token_verified") return { status: "unavailable" };
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { status: "unavailable" };
    const admin = createServiceClient<EquipmentDatabase>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const client = await createClient();
    const intent = equipmentRequestIntent(request);
    const prior = await client.from("character_starting_grants").select("status,canonical_intent,receipt")
      .eq("character_id", request.characterId).eq("grant_kind", "starting_equipment").maybeSingle();
    if (prior.error) return { status: "unavailable" };
    // Recover from the original durable plan before consulting today's sources.
    // The RPC still checks the current Auth session and current owner under locks.
    const stored = prior.data?.canonical_intent;
    if (prior.data?.status === "awarded") {
      if (!stored || typeof stored !== "object" || Array.isArray(stored)
        || !equalEquipmentIntent({ selections: stored.selections, sources: stored.sources }, intent)) return { status: "conflict" };
      const recovered = await admin.rpc("commit_character_builder_equipment_v1", {
        p_context: { ...verified.context }, p_request: { contract_version: 1, operation_id: randomUUID(),
          character_id: request.characterId, expected_choices: {}, expected_refs: [], canonical_intent: stored },
      });
      const result = !recovered.error && startingEquipmentResultSchema.safeParse(recovered.data);
      if (!result || !result.success || (result.data.status === "awarded"
        && !equalEquipmentIntent(result.data.receipt.plan, stored.plan))) return { status: "uncertain" };
      return result.data;
    }
    const selected = await client.from("characters").select("id,user_id,system_id,choices")
      .eq("id", request.characterId).single();
    const character = selected.data;
    if (selected.error || !character || character.user_id !== verified.context.actor_id) return { status: "unavailable" };
    const saved = equipmentSelectionsSchema.safeParse(character.choices?.starting_equipment);
    if (!saved.success || saved.data.confirmed || !equalEquipmentIntent(
      { selections: saved.data.selections, picks: saved.data.picks }, intent.selections)) return { status: "conflict" };
    const refs = await getContentRefsByCharacter(request.characterId, { requireCompleteSnapshots: true, fresh: true });
    const classes = refs.filter(ref => ref.content_definitions.content_type === "class");
    const backgrounds = refs.filter(ref => ref.content_definitions.content_type === "background");
    if (classes.length !== 1 || backgrounds.length !== 1) return { status: "conflict" };
    const primary = classes[0].content_definitions, background = backgrounds[0].content_definitions;
    if (primary.slug !== character.choices?.classes?.[0]?.slug || background.slug !== character.choices?.background
      || !equalEquipmentIntent({ class: { id: primary.id, version: primary.version },
        background: { id: background.id, version: background.version } }, request.sources)) return { status: "conflict" };
    const catalog = (await Promise.all(["weapon", "armor", "item"].map(type => getContentByType(character.system_id, type)))).flat().map(row => ({
      id: row.id, version: row.version, name: row.name, slug: row.slug, content_type: row.content_type,
      weapon_category: typeof row.data.weapon_category === "string" ? row.data.weapon_category : null,
      weapon_range: typeof row.data.weapon_range === "string" ? row.data.weapon_range : null,
    }));
    const groups = parseEquipmentGroups({ classText: typeof primary.data.equipment === "string" ? primary.data.equipment : null,
      backgroundText: typeof background.data.equipment === "string" ? background.data.equipment : null });
    if (!isSelectionComplete(groups, saved.data, catalog)) return { status: "conflict" };
    const plan = equipmentPlanSchema.safeParse(buildInventoryGrants(groups, saved.data, catalog));
    if (!plan.success) return { status: "conflict" };
    const expectedRefs = refs.map(ref => ({ content_id: ref.content_id, content_version: ref.content_version }))
      .sort((a, b) => a.content_id.localeCompare(b.content_id) || a.content_version - b.content_version);
    const original = { contract_version: 1, operation_id: randomUUID(), character_id: request.characterId,
      expected_choices: character.choices, expected_refs: expectedRefs,
      canonical_intent: { ...intent, plan: plan.data } };
    try {
      const committed = await admin.rpc("commit_character_builder_equipment_v1", {
        p_context: { ...verified.context }, p_request: original,
      });
      if (committed.error) reportRefusal(committed.error);
      const result = !committed.error && startingEquipmentResultSchema.safeParse(committed.data);
      if (!result || !result.success || (result.data.status === "awarded"
        && !equalEquipmentIntent(result.data.receipt.plan, plan.data))) return { status: "uncertain" };
      return result.data;
    } catch { return { status: "uncertain" }; }
  } catch { return { status: "unavailable" }; }
}
