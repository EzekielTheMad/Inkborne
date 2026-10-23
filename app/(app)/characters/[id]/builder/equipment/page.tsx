import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { redirect, notFound } from "next/navigation";
import { EquipmentStepClient } from "./equipment-step-client";
import { startingEquipmentReceiptSchema } from "@/lib/builder/starting-equipment-contract";
import type { EquipmentCatalogItem } from "@/lib/builder/equipment-choices";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { saveBuilderStep } from "../step-actions";
import { getBuilderStepStatus } from "@/lib/builder/step-status";
import { isLanguageChoiceCategory } from "@/lib/builder/choice-validation";
import type { CreationStep } from "@/lib/types/system";
import { savedBuilderClassSpellsComplete } from "@/lib/builder/class-spells-status-server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EquipmentStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[EquipmentStepPage] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[EquipmentStepPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character || character.user_id !== user.id) notFound();
  if (characterCreationUIEnabled() && !character.choices?.classes?.length) redirect(`/characters/${id}/builder/first-class`);

  const readBuild = async () => {
    const snapshot = await getCharacterContentRefSnapshot(id, { fresh: true });
    if (!snapshot.complete) throw Error("The saved build could not be read. Reload before finishing.");
    const refs = snapshot.refs;
    const hasLanguageCategory = refs.some(ref => ref.content_definitions.effects?.some(effect => effect.type === "choice" && isLanguageChoiceCategory(effect)));
    const languages = hasLanguageCategory ? await getContentByType(character.system_id, "language").then(rows => rows.map(row => row.slug)) : undefined;
    const schema = character.game_systems?.schema_definition;
    const steps: CreationStep[] = schema?.creation_steps ?? [];
    const classSpellsComplete = !characterCreationUIEnabled() || await savedBuilderClassSpellsComplete(character, snapshot, schema);
    const incomplete = characterCreationUIEnabled() ? steps
      .filter(step => step.type !== "equipment" && getBuilderStepStatus(step.type, character.choices ?? {}, character.base_stats ?? {}, schema, refs, languages, classSpellsComplete) !== "complete")
      .map(step => ({ type: step.type, label: step.label })) : undefined;
    return { refs, incomplete };
  };

  // Owner-policy read preserves terminal recovery on reload even with disabled
  // new awards, missing pins, consumed inventory or an unavailable catalog.
  const grant = await supabase.from("character_starting_grants")
    .select("status, receipt").eq("character_id", id).eq("grant_kind", "starting_equipment").maybeSingle();
  if (grant.error && !["42P01", "PGRST205"].includes(grant.error.code)) {
    throw new Error("The saved equipment award could not be read. Reload before continuing.");
  }
  if (grant.data?.status === "awarded" || grant.data?.status === "inherited_completion") {
    const receipt = startingEquipmentReceiptSchema.safeParse(grant.data.receipt);
    if (grant.data.status === "awarded" && !receipt.success) throw new Error("The saved equipment award could not be read.");
    const completion = grant.data.status === "awarded" && receipt.success
      ? { status: "awarded" as const, receipt: receipt.data }
      : { status: "inherited_completion" as const };
    // A recorded award remains readable when another saved snapshot/catalog is
    // unavailable. Completion can stay blocked without hiding that receipt.
    const incompleteSteps = await readBuild().then(build => build.incomplete,
      () => characterCreationUIEnabled() ? [{ type: "", label: "Review saved build" }] : undefined);
    return <EquipmentStepClient characterId={id} character={character} classContent={null} backgroundContent={null} catalog={[]} completion={completion} incompleteSteps={incompleteSteps} />;
  }

  // Starting equipment comes from the exact class/background snapshots pinned
  // to this character. Catalog items remain current because the player is
  // making a new equipment selection now.
  const classSlug = character.choices?.classes?.[0]?.slug;
  const backgroundSlug = character.choices?.background;
  const { refs: contentRefs, incomplete: incompleteSteps } = await readBuild();

  const [weapons, armor, items] = await Promise.all([
    getContentByType(character.system_id, "weapon"),
    getContentByType(character.system_id, "armor"),
    getContentByType(character.system_id, "item"),
  ]);

  const classContent =
    contentRefs
      .map((ref) => ref.content_definitions)
      .find(
        (entry) =>
          entry.content_type === "class" && entry.slug === classSlug,
      ) ?? null;
  const backgroundContent =
    contentRefs
      .map((ref) => ref.content_definitions)
      .find(
        (entry) =>
          entry.content_type === "background" && entry.slug === backgroundSlug,
      ) ?? null;

  const catalog: EquipmentCatalogItem[] = [...weapons, ...armor, ...items].map((row) => {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      version: row.version,
      name: row.name,
      slug: row.slug,
      content_type: row.content_type,
      weapon_category:
        typeof data.weapon_category === "string" ? data.weapon_category : null,
      weapon_range:
        typeof data.weapon_range === "string" ? data.weapon_range : null,
    };
  });

  return (
    <EquipmentStepClient
      characterId={id}
      character={character}
      classContent={classContent}
      backgroundContent={backgroundContent}
      catalog={catalog}
      saveAction={characterCreationUIEnabled() ? saveBuilderStep.bind(null, user.id, id) : undefined}
      incompleteSteps={incompleteSteps}
    />
  );
}
