import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { redirect, notFound } from "next/navigation";
import { ClassStepClient } from "./class-step-client";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { saveBuilderStep, previewSubclassContentUpdate } from "../step-actions";
import { parseNestedContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { resolveEffectiveCastingSources } from "@/lib/spells/effective-sources";
import { resolveBuilderEquipmentPreview } from "@/lib/builder/preview-equipment";
import type { InventoryItem } from "@/lib/types/inventory";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClassStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[ClassStepPage] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition), campaigns (id, hp_rule)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[ClassStepPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character || character.user_id !== user.id) notFound();
  if (characterCreationUIEnabled() && !character.choices?.classes?.length) redirect(`/characters/${id}/builder/first-class`);

  const systemId = character.system_id;

  const [classContent, subclassContent, featureContent, spells, contentSnapshot, languages, savedSpells, savedEquipment] =
    await Promise.all([
      getContentByType(systemId, "class", true),
      getContentByType(systemId, "subclass", true),
      getContentByType(systemId, "feature", true),
      getContentByType(systemId, "spell", true),
      getCharacterContentRefSnapshot(id),
      getContentByType(systemId, "language", true),
      supabase.from("character_spells").select(`content_id,content_version,is_prepared,always_prepared,in_spellbook,source,class_slug,
        content_versions!character_spells_content_version_fkey(content_id,version,system_id_snapshot,content_type_snapshot,slug_snapshot,name_snapshot,data_snapshot,effects_snapshot,source_snapshot,scope_snapshot,owner_id_snapshot)`)
        .eq("character_id", id),
      supabase.from("character_inventory").select(`*,
        content_versions!character_inventory_content_version_fkey(content_id,version,system_id_snapshot,content_type_snapshot,slug_snapshot,name_snapshot,data_snapshot,effects_snapshot,source_snapshot,scope_snapshot,owner_id_snapshot)`, { count: "exact" })
        .eq("character_id", id).eq("equipped", true),
    ]);
  if (savedSpells.error) throw Error("The saved spell selections could not be read. Reload before editing.");
  if (savedEquipment.error || !Array.isArray(savedEquipment.data) || savedEquipment.count !== savedEquipment.data.length) {
    throw Error("Saved equipped items are unavailable. Reload or restore the character's saved equipment.");
  }
  const equipmentPreview = resolveBuilderEquipmentPreview(id, systemId, savedEquipment.data.map(row => ({ ...row,
    content_definitions: parseNestedContentVersionSnapshot(row.content_versions),
  })) as InventoryItem[]);
  const savedSpellEntries = (savedSpells.data ?? []).flatMap(row => {
    const definition = parseNestedContentVersionSnapshot(row.content_versions);
    return definition && definition.id === row.content_id && definition.version === row.content_version ? [definition] : [];
  });
  const pinnedSpellEntries = [...savedSpellEntries, ...contentSnapshot.refs.flatMap(ref => ref.content_definitions.content_type === "spell"
    && ref.content_id === ref.content_definitions.id && ref.content_version === ref.content_definitions.version ? [ref.content_definitions] : [])];
  const spellCatalog = [...spells, ...pinnedSpellEntries].filter((spell, index, all) =>
    all.findIndex(other => other.id === spell.id && other.version === spell.version) === index);
  const casting = resolveEffectiveCastingSources(character.choices?.classes ?? [], contentSnapshot.refs, character);

  return (
    <ClassStepClient
      accountId={user.id}
      previewContentUpdateAction={characterCreationUIEnabled() ? previewSubclassContentUpdate.bind(null, user.id, id) : undefined}
      saveAction={characterCreationUIEnabled() ? saveBuilderStep.bind(null, user.id, id) : undefined}
      classRolesAvailable={contentSnapshot.classRoles.status === "available" && contentSnapshot.classRoles.action_revision === String(character.action_revision)}
      castingSources={casting.status === "available" ? casting.sources : []}
      selectedSpells={(savedSpells.data ?? []).filter(row => row.source === "selection" && row.content_id && row.content_version)
        .map(row => {
          const choices: unknown = character.choices?.class_spell_selections?.[row.class_slug];
          const intent = Array.isArray(choices) ? choices.find(item => item?.content_id === row.content_id
            && item?.content_version === row.content_version && typeof item?.prepared === "boolean")?.prepared : undefined;
          return { content_id: row.content_id!, content_version: row.content_version!, is_prepared: row.is_prepared,
            always_prepared: row.always_prepared, prepared_intent: intent, class_slug: row.class_slug };
        })}
      grantedSpells={(savedSpells.data ?? []).filter(row => row.source !== "selection" && row.content_id)
        .map(row => ({ content_id: row.content_id!, class_slug: row.class_slug }))}
      characterId={id}
      equipmentPreview={equipmentPreview}
      character={character}
      classes={classContent}
      subclasses={subclassContent}
      features={featureContent}
      availableLanguages={languages.map(language => language.slug)}
      feats={[]}
      spells={spellCatalog}
      contentRefs={contentSnapshot.refs}
      asiEvidence={contentSnapshot.asiEvidence}
      schema={character.game_systems?.schema_definition}
    />
  );
}
