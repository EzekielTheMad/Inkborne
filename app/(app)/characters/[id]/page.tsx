import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { evaluate } from "@/lib/engine/evaluator";
import type { StructuredSources } from "@/lib/engine/evaluator";
import { initializeState } from "@/lib/sheet/helpers";
import { computeMaxHp } from "@/lib/character/max-hp";
import { CharacterPageClient } from "@/components/character/character-page-client";
import type { Effect } from "@/lib/types/effects";

interface PageProps {
  params: Promise<{ id: string }>;
}

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
  const contentRefs = await getContentRefsByCharacter(id).catch(() => []);

  // Fetch inventory
  const { data: inventoryRows } = await supabase
    .from("character_inventory")
    .select("*, content_definitions(id, name, slug, content_type, data, effects)")
    .eq("character_id", id)
    .order("sort_order")
    .order("name");

  // Fetch spells for this character.
  const { data: spellRows } = await supabase
    .from("character_spells")
    .select("*, content_definitions(id, name, slug, content_type, data, effects)")
    .eq("character_id", id)
    .order("name");

  // Fetch class content for caster classes to derive spellcasting metadata.
  const classChoices =
    ((character.choices as { classes?: Array<{ slug: string; level: number; subclass?: string }> })
      ?.classes) ?? [];
  const classSlugs = classChoices.map((c) => c.slug);
  const subclassSlugs = classChoices
    .map((c) => c.subclass)
    .filter((s): s is string => !!s);

  const [classContentRes, subclassContentRes] = await Promise.all([
    classSlugs.length > 0
      ? supabase
          .from("content_definitions")
          .select("slug, data")
          .eq("system_id", character.system_id)
          .eq("content_type", "class")
          .in("slug", classSlugs)
      : Promise.resolve({ data: [] as Array<{ slug: string; data: Record<string, unknown> }> }),
    subclassSlugs.length > 0
      ? supabase
          .from("content_definitions")
          .select("slug, data")
          .eq("system_id", character.system_id)
          .eq("content_type", "subclass")
          .in("slug", subclassSlugs)
      : Promise.resolve({ data: [] as Array<{ slug: string; data: Record<string, unknown> }> }),
  ]);

  const classData: Record<string, { slug: string; data: Record<string, unknown> }> = {};
  for (const row of classContentRes.data ?? []) {
    classData[row.slug] = row;
  }

  const subclassData: Record<string, { spellcastingExtra?: Array<{ level: number; spells: string[] }> | null }> = {};
  for (const row of subclassContentRes.data ?? []) {
    const extras = (row.data as Record<string, unknown>)?.spellcastingExtra;
    subclassData[row.slug] = {
      spellcastingExtra: Array.isArray(extras)
        ? (extras as Array<{ level: number; spells: string[] }>)
        : null,
    };
  }

  // Run always-prepared sync.
  if (classChoices.length > 0) {
    const { resolveFeatureGrantedSpells } = await import("@/lib/spells/helpers");
    const { syncAlwaysPreparedSpells } = await import("@/lib/supabase/spells");
    const granted = resolveFeatureGrantedSpells(classChoices, subclassData);
    if (granted.length > 0) {
      await syncAlwaysPreparedSpells(id, granted, {});
    }
  }

  // Re-fetch spells after sync so the client gets the feature-granted rows.
  const { data: spellRowsAfterSync } = await supabase
    .from("character_spells")
    .select("*, content_definitions(id, name, slug, content_type, data, effects)")
    .eq("character_id", id)
    .order("name");

  // Fetch class features at the character's current levels
  let classFeatures: Array<{ effects: Effect[]; data: Record<string, unknown> }> = [];

  if (classChoices.length > 0) {
    const { data: featureRows } = await supabase
      .from("content_definitions")
      .select("effects, data")
      .eq("system_id", character.system_id)
      .eq("content_type", "feature")
      .in("data->>class", classChoices.map((c: { slug: string }) => c.slug));

    if (featureRows) {
      classFeatures = featureRows.filter((f) => {
        const featureClass = f.data?.class as string | undefined;
        const featureLevel = f.data?.level as number | undefined;
        const featureSubclass = f.data?.subclass as string | null | undefined;
        if (!featureClass || featureLevel == null) return false;
        const classEntry = classChoices.find((c: { slug: string }) => c.slug === featureClass);
        if (!classEntry || featureLevel > classEntry.level) return false;
        if (featureSubclass) return classEntry.subclass === featureSubclass;
        return true;
      });
    }
  }

  // Collect all effects
  const allEffects: Effect[] = [
    ...contentRefs.flatMap((ref) => ref.content_definitions?.effects ?? []),
    ...classFeatures.flatMap((f) => f.effects ?? []),
  ];

  // Build structured sources
  const raceRef = contentRefs.find((r) => r.content_definitions?.content_type === "race");
  const classRef = contentRefs.find((r) => r.content_definitions?.content_type === "class");
  const featureRefs = contentRefs.filter((r) => r.content_definitions?.content_type === "feature");

  const structuredSources: StructuredSources = {
    raceData: raceRef?.content_definitions?.data as StructuredSources["raceData"],
    classData: classRef?.content_definitions?.data as StructuredSources["classData"],
    featureData: [
      ...featureRefs.map((r) => r.content_definitions?.data as NonNullable<StructuredSources["featureData"]>[number]),
      ...classFeatures.map((f) => f.data as NonNullable<StructuredSources["featureData"]>[number]),
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
      character={character}
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
      classData={classData}
    />
  );
}
