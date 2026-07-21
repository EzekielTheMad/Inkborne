import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { parseNestedContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { evaluate } from "@/lib/engine/evaluator";
import type { StructuredSources } from "@/lib/engine/evaluator";
import { initializeState } from "@/lib/sheet/helpers";
import { computeMaxHp } from "@/lib/character/max-hp";
import { CharacterPageClient } from "@/components/character/character-page-client";
import {
  applyActiveSpellGrantOverlays,
  getActiveSpellGrants,
  syncAlwaysPreparedSpells,
} from "@/lib/supabase/spells-server";
import type { ActiveSpellGrant } from "@/lib/supabase/spells-server";
import { syncClassFeatureRefs } from "@/lib/supabase/feature-refs-server";
import { reportServerError } from "@/lib/supabase/errors";
import type { Effect } from "@/lib/types/effects";
import type { InventoryItem } from "@/lib/types/inventory";
import type { CharacterSpell } from "@/lib/types/spells";
import { findCampaignPageCharacterBacklinks } from "@/lib/campaigns/backlinks";
import { normalizeRichTextContent } from "@/lib/editor/content";
import type { JSONContent } from "@tiptap/react";
import type {
  CharacterRelationship,
  CharacterTimelineEvent,
} from "@/lib/types/narrative";

interface PageProps {
  params: Promise<{ id: string }>;
}

const SNAPSHOT_FIELDS = `
  content_id, version, system_id_snapshot, content_type_snapshot,
  slug_snapshot, name_snapshot, data_snapshot, effects_snapshot,
  source_snapshot, scope_snapshot, owner_id_snapshot
`;
const INVENTORY_WITH_VERSION_SELECT =
  `*, content_versions!character_inventory_content_version_fkey(${SNAPSHOT_FIELDS})`;
const SPELLS_WITH_VERSION_SELECT =
  `*, content_versions!character_spells_content_version_fkey(${SNAPSHOT_FIELDS})`;

export default async function CharacterPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const character = await getCharacterWithSystem(id).catch(() => null);
  if (!character) notFound();

  const isOwner = character.user_id === user.id;

  // Determine if current user is DM of the campaign
  let isDm = false;
  if (character.campaign_id) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", character.campaign_id)
      .single();
    if (campaign) {
      isDm = campaign.owner_id === user.id;
    }
  }

  // Fetch content refs for sheet evaluation
  let contentRefs = await getContentRefsByCharacter(id);

  // Fetch inventory
  const { data: inventoryRowsRaw, error: inventoryError } = await supabase
    .from("character_inventory")
    .select(INVENTORY_WITH_VERSION_SELECT)
    .eq("character_id", id)
    .order("sort_order")
    .order("name");
  if (inventoryError) throw inventoryError;
  const inventoryRows = (inventoryRowsRaw ?? []).map((row) => ({
    ...row,
    content_definitions: parseNestedContentVersionSnapshot(row.content_versions),
  })) as InventoryItem[];

  // Fetch the most recent persisted rolls for the roll log (newest first).
  const { data: rollRows } = await supabase
    .from("character_rolls")
    .select("*")
    .eq("character_id", id)
    .order("rolled_at", { ascending: false })
    .limit(50);

  // Fetch spells for this character.
  const { data: spellRowsRaw, error: spellRowsError } = await supabase
    .from("character_spells")
    .select(SPELLS_WITH_VERSION_SELECT)
    .eq("character_id", id)
    .order("name");
  if (spellRowsError) throw spellRowsError;
  const spellRows = (spellRowsRaw ?? []).map((row) => ({
    ...row,
    content_definitions: parseNestedContentVersionSnapshot(row.content_versions),
  })) as CharacterSpell[];

  // Fetch class content for caster classes to derive spellcasting metadata.
  const classChoices =
    ((character.choices as { classes?: Array<{ slug: string; level: number; subclass?: string }> })
      ?.classes) ?? [];
  // Automatic class/subclass features are materialized as exact-version refs
  // the first time they are earned. Only the character owner may reconcile
  // them; DMs retain a strictly read-only view of the player's pinned sheet.
  if (isOwner) {
    try {
      const syncResult = await syncClassFeatureRefs(supabase, {
        characterId: id,
        classChoices,
      });
      if (syncResult.inserted > 0 || syncResult.deleted > 0) {
        contentRefs = await getContentRefsByCharacter(id);
      }
    } catch (error) {
      const syncError = error instanceof Error ? error : new Error(String(error));
      console.error("[CharacterPage] Failed to sync class feature refs:", syncError);
      await reportServerError({
        source: "manual",
        message: syncError.message,
        stack: syncError.stack,
        userId: user.id,
        context: { characterId: id, operation: "sync_class_feature_refs" },
      });
    }
  }

  const classContent = contentRefs
    .filter((ref) => ref.content_definitions.content_type === "class")
    .map((ref) => ref.content_definitions);
  const classData: Record<string, { slug: string; data: Record<string, unknown> }> = {};
  for (const row of classContent) {
    classData[row.slug] = row;
  }

  let spellRowsAfterSync = spellRows;
  let activeSpellGrants: ActiveSpellGrant[] = [];

  // Viewing a character is read-only for DMs. Only the character owner may
  // reconcile derived, feature-granted spell rows.
  if (isOwner) {
    try {
      const syncResult = await syncAlwaysPreparedSpells(supabase, {
        characterId: id,
      });
      activeSpellGrants = syncResult.activeGrants;

      if (syncResult.inserted > 0 || syncResult.deleted > 0) {
        const { data, error } = await supabase
          .from("character_spells")
          .select(SPELLS_WITH_VERSION_SELECT)
          .eq("character_id", id)
          .order("name");
        if (error) throw error;
        spellRowsAfterSync = (data ?? []).map((row) => ({
          ...row,
          content_definitions: parseNestedContentVersionSnapshot(
            row.content_versions,
          ),
        })) as CharacterSpell[];
      }
    } catch (error) {
      const syncError = error instanceof Error ? error : new Error(String(error));
      console.error("[CharacterPage] Failed to sync feature-granted spells:", syncError);
      await reportServerError({
        source: "manual",
        message: syncError.message,
        stack: syncError.stack,
        userId: user.id,
        context: { characterId: id, operation: "sync_feature_granted_spells" },
      });
    }
  } else {
    try {
      activeSpellGrants = await getActiveSpellGrants(supabase, {
        characterId: id,
      });
    } catch (error) {
      const readError = error instanceof Error ? error : new Error(String(error));
      console.error("[CharacterPage] Failed to read active spell grants:", readError);
      await reportServerError({
        source: "manual",
        message: readError.message,
        stack: readError.stack,
        userId: user.id,
        context: { characterId: id, operation: "read_active_spell_grants" },
      });
    }
  }
  spellRowsAfterSync = applyActiveSpellGrantOverlays(
    spellRowsAfterSync,
    activeSpellGrants,
  );

  const [
    { data: dmNotes },
    { data: campaignLinkCandidates },
    { data: timelineRows },
    { data: relationshipRows },
  ] = await Promise.all([
    supabase
      .from("character_dm_notes")
      .select("content")
      .eq("character_id", id)
      .maybeSingle(),
    character.campaign_id
      ? supabase
          .from("campaign_pages")
          .select("id, title, content")
          .eq("campaign_id", character.campaign_id)
          .order("title")
      : Promise.resolve({ data: [] }),
    supabase
      .from("character_timeline_events")
      .select("*")
      .eq("character_id", id)
      .order("sort_order")
      .order("created_at"),
    supabase.from("npcs").select("*").eq("character_id", id).order("created_at"),
  ]);
  const characterForView = dmNotes
    ? {
        ...character,
        narrative_rich: {
          ...character.narrative_rich,
          backstory_dm_notes: dmNotes.content,
        },
      }
    : character;

  const campaignPageBacklinks = findCampaignPageCharacterBacklinks(
    campaignLinkCandidates ?? [],
    character.id,
  );
  const timelineEvents: CharacterTimelineEvent[] = (timelineRows ?? []).map((event) => ({
    ...event,
    description: normalizeRichTextContent(event.description) as JSONContent,
    visibility: event.visibility === "campaign" ? "campaign" : "dm_only",
  }));
  const relationships: CharacterRelationship[] = (relationshipRows ?? []).map((relationship) => ({
    ...relationship,
    description: normalizeRichTextContent(relationship.description) as JSONContent,
    visibility: relationship.visibility === "campaign" ? "campaign" : "dm_only",
  }));

  // Collect all effects
  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  // Build structured sources
  const raceRef = contentRefs.find((r) => r.content_definitions?.content_type === "race");
  const classRef = contentRefs.find((r) => r.content_definitions?.content_type === "class");
  const featureRefs = contentRefs.filter((r) => r.content_definitions?.content_type === "feature");

  const structuredSources: StructuredSources = {
    raceData: raceRef?.content_definitions?.data as StructuredSources["raceData"],
    classData: classRef?.content_definitions?.data as StructuredSources["classData"],
    featureData: [
      ...featureRefs.map((r) => r.content_definitions?.data as NonNullable<StructuredSources["featureData"]>[number]),
    ].filter(Boolean),
    level: character.level,
  };

  // Run expression engine
  const baseStatsWithLevel = { ...character.base_stats, level: character.level };
  const schema = character.game_systems.schema_definition;
  const evalResult = evaluate(baseStatsWithLevel, allEffects, schema, structuredSources, character.state as Record<string, unknown>);

  // Max HP is computed from class hit dice + CON mod, per RAW multiclassing rules.
  // (The engine's derived-stat formula can't express per-class iteration, so we
  // compute it directly here using the helper in lib/character/max-hp.ts.)
  const constitutionScore = (evalResult.stats.constitution as number | undefined) ?? 10;
  const hpRolls = (character.choices?.hp_rolls ?? {}) as Record<string, import("@/lib/types/character").HpRollRecord>;
  const hpRule = (character.game_systems?.schema_definition as { hp_rule?: import("@/lib/builder/level-up-rules").HpRule } | undefined)?.hp_rule ?? "free_choice";
  const maxHp = computeMaxHp(classChoices, classData, constitutionScore, hpRolls, hpRule);
  const initialState = initializeState(character.state, maxHp);

  const hasSheet = character.choices?.classes && character.choices.classes.length > 0;

  return (
    <CharacterPageClient
      character={characterForView}
      schema={schema}
      evalResult={evalResult}
      contentRefs={contentRefs}
      initialState={initialState}
      maxHp={maxHp}
      allEffects={allEffects}
      baseStatsWithLevel={baseStatsWithLevel}
      structuredSources={structuredSources}
      isOwner={isOwner}
      isDm={isDm}
      hasSheet={hasSheet ?? false}
      initialInventory={inventoryRows ?? []}
      initialSpells={spellRowsAfterSync ?? spellRows ?? []}
      initialRolls={(rollRows ?? []) as import("@/lib/types/rolls").RollLogEntry[]}
      classData={classData}
      campaignPageBacklinks={campaignPageBacklinks}
      timelineEvents={timelineEvents}
      relationships={relationships}
    />
  );
}
