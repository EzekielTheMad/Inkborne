import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { redirect, notFound } from "next/navigation";
import { ClassStepClient } from "./class-step-client";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { saveBuilderStep } from "../step-actions";
import { resolveEffectiveCastingSources } from "@/lib/spells/effective-sources";

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

  const [classContent, subclassContent, featureContent, spells, contentSnapshot, languages, savedSpells] =
    await Promise.all([
      getContentByType(systemId, "class"),
      getContentByType(systemId, "subclass"),
      getContentByType(systemId, "feature"),
      getContentByType(systemId, "spell"),
      getCharacterContentRefSnapshot(id),
      getContentByType(systemId, "language"),
      supabase.from("character_spells").select("content_id,content_version,is_prepared,source,class_slug").eq("character_id", id),
    ]);
  if (savedSpells.error) throw Error("The saved spell selections could not be read. Reload before editing.");
  const casting = resolveEffectiveCastingSources(character.choices?.classes ?? [], contentSnapshot.refs, character);

  return (
    <ClassStepClient
      saveAction={characterCreationUIEnabled() ? saveBuilderStep.bind(null, user.id, id) : undefined}
      castingSources={casting.status === "available" ? casting.sources : []}
      selectedSpells={(savedSpells.data ?? []).filter(row => row.source === "selection" && row.content_id && row.content_version)
        .map(row => ({ content_id: row.content_id!, content_version: row.content_version!, is_prepared: row.is_prepared, class_slug: row.class_slug }))}
      grantedSpells={(savedSpells.data ?? []).filter(row => row.source !== "selection" && row.content_id)
        .map(row => ({ content_id: row.content_id!, class_slug: row.class_slug }))}
      characterId={id}
      character={character}
      classes={classContent}
      subclasses={subclassContent}
      features={featureContent}
      availableLanguages={languages.map(language => language.slug)}
      feats={[]}
      spells={spells}
      contentRefs={contentSnapshot.refs}
      asiEvidence={contentSnapshot.asiEvidence}
      schema={character.game_systems?.schema_definition}
    />
  );
}
