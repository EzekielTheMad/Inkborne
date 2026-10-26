"use server";

import { createClient } from "@/lib/supabase/server";
import { createStartingEquipmentClient, startingEquipmentEnabled } from "@/lib/supabase/starting-equipment-server";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { buildInventoryGrants, isSelectionComplete, parseEquipmentGroups } from "@/lib/builder/equipment-choices";
import { equipmentRequestSchema, equipmentRequestIntent, equipmentSelectionsSchema, equipmentPlanSchema, equalEquipmentIntent, startingEquipmentResultSchema, type StartingEquipmentResult } from "@/lib/builder/starting-equipment-contract";
import type { Json } from "@/lib/supabase/database.types";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { confirmBuilderEquipment } from "@/lib/supabase/builder-equipment-server";

export async function confirmStartingEquipment(input: unknown): Promise<StartingEquipmentResult> {
  const parsed = equipmentRequestSchema.safeParse(input);
  if (!parsed.success) return { status: "conflict" };
  const request = parsed.data;
  if (characterCreationUIEnabled()) return confirmBuilderEquipment(request);
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "unavailable" };
    const admin = createStartingEquipmentClient();
    const requestIntent = equipmentRequestIntent(request);
    // Locked ownership check and durable receipt resolution precede rollout gate
    // and all current source/catalog reads. No inventory/currency reconstruction.
    const recovered = await admin.rpc("resolve_starting_equipment", {
      actor_id: user.id, target_character_id: request.characterId, request_intent: requestIntent as Json,
    });
    if (recovered.error) return { status: "unavailable" };
    const terminal = startingEquipmentResultSchema.safeParse(recovered.data);
    if (terminal.success) return terminal.data;
    if (!recovered.data || typeof recovered.data !== "object" || Array.isArray(recovered.data) || recovered.data.status !== "eligible") return { status: "unavailable" };
    if (!startingEquipmentEnabled()) return { status: "unavailable" };

    const { data: character, error } = await supabase.from("characters").select("*").eq("id", request.characterId).single();
    if (error || !character || character.user_id !== user.id) return { status: "unavailable" };
    const saved = equipmentSelectionsSchema.safeParse(character.choices?.starting_equipment);
    if (!saved.success || saved.data.confirmed || !equalEquipmentIntent(
      { selections: saved.data.selections, picks: saved.data.picks }, requestIntent.selections,
    )) return { status: "conflict" };
    const refs = await getContentRefsByCharacter(request.characterId, { requireCompleteSnapshots: true, fresh: true });
    const classRefs = refs.filter(ref => ref.content_definitions.content_type === "class" && ref.content_definitions.slug === character.choices?.classes?.[0]?.slug);
    const backgrounds = refs.filter(ref => ref.content_definitions.content_type === "background");
    if (classRefs.length !== 1 || backgrounds.length > 1) return { status: "conflict" };
    const primary = classRefs[0].content_definitions;
    const background = backgrounds[0]?.content_definitions ?? null;
    if ((character.choices?.background ?? null) !== (background?.slug ?? null)) return { status: "conflict" };
    const sources = { class: { id: primary.id, version: primary.version }, background: background ? { id: background.id, version: background.version } : null };
    if (!equalEquipmentIntent(sources, request.sources)) return { status: "conflict" };
    const catalog = (await Promise.all(["weapon", "armor", "item"].map(type => getContentByType(character.system_id, type, true)))).flat().map(row => ({
      id: row.id, version: row.version, name: row.name, slug: row.slug, content_type: row.content_type,
      weapon_category: typeof row.data.weapon_category === "string" ? row.data.weapon_category : null,
      weapon_range: typeof row.data.weapon_range === "string" ? row.data.weapon_range : null,
    }));
    const groups = parseEquipmentGroups({
      classText: typeof primary.data.equipment === "string" ? primary.data.equipment : null,
      backgroundText: typeof background?.data.equipment === "string" ? background.data.equipment : null,
    });
    if (!isSelectionComplete(groups, saved.data, catalog)) return { status: "conflict" };
    const plan = equipmentPlanSchema.safeParse(buildInventoryGrants(groups, saved.data, catalog));
    if (!plan.success) return { status: "conflict" };
    const expectedRefs = refs.map(ref => ({ content_id: ref.content_id, content_version: ref.content_version })).sort((a, b) => a.content_id.localeCompare(b.content_id) || a.content_version - b.content_version);
    try {
      const committed = await admin.rpc("commit_starting_equipment", {
        actor_id: user.id, target_character_id: request.characterId,
        expected_choices: character.choices as Json, expected_refs: expectedRefs as Json,
        canonical_intent: { ...requestIntent, plan: plan.data } as Json,
      });
      if (committed.error) return { status: "uncertain" };
      const result = startingEquipmentResultSchema.safeParse(committed.data);
      return result.success ? result.data : { status: "uncertain" };
    } catch {
      return { status: "uncertain" };
    }
  } catch {
    // No grant request was made: unavailable configuration/source reads. Errors
    // must not serialize credentials or raw authenticated responses to clients.
    return { status: "unavailable" };
  }
}
