"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ClassPreviewModal } from "@/components/builder/class-preview-modal";
import { ClassStepRail } from "@/components/builder/class-step-rail";
import { StatPreview } from "@/components/builder/stat-preview";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { resolveHpRule, type HpRule } from "@/lib/builder/level-up-rules";
import type { Effect } from "@/lib/types/effects";
import { evaluate } from "@/lib/engine/evaluator";

interface ClassStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  classes: ContentEntry[];
  subclasses: ContentEntry[];
  features: ContentEntry[];
  spells: ContentEntry[];
  contentRefs: Array<{
    id: string;
    content_id: string;
    context: Record<string, unknown>;
    choice_source: string | null;
    content_definitions: {
      id: string;
      name: string;
      slug: string;
      content_type: string;
      data: Record<string, unknown>;
      effects: Effect[];
    };
  }>;
  schema: SystemSchemaDefinition | undefined;
}

export function ClassStepClient({
  characterId,
  character,
  classes,
  subclasses,
  features,
  spells,
  contentRefs,
  schema,
}: ClassStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );
  const [localLevel, setLocalLevel] = useState(character.level);

  const selectedClasses = localChoices.classes ?? [];
  const hasClass = selectedClasses.length > 0;

  const hpRule = resolveHpRule(
    (character as unknown as { campaigns?: { hp_rule?: HpRule | null } | null }).campaigns?.hp_rule,
    (schema as unknown as { hp_rule?: HpRule } | undefined)?.hp_rule,
  );

  const hpRolls = localChoices.hp_rolls ?? {};

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  const resolvedStats = useMemo(() => {
    if (!schema) return character.base_stats ?? {};
    const baseWithLevel = { ...(character.base_stats ?? {}), level: localLevel };
    return evaluate(baseWithLevel, allEffects, schema).stats;
  }, [character.base_stats, localLevel, allEffects, schema]);

  async function handleSelectClass(
    content: ContentEntry,
    opts?: { subclassSlug?: string | null },
  ) {
    setPreviewContent(null);

    const subclassSlug = opts?.subclassSlug ?? undefined;
    const newClasses = [
      ...selectedClasses,
      { slug: content.slug, level: 1, subclass: subclassSlug },
    ];
    const totalLevel = newClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: newClasses };

    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    // Persist character.choices + level
    await supabase
      .from("characters")
      .update({ choices: newChoices, level: totalLevel })
      .eq("id", characterId);

    // Class content_ref
    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: content.id,
        content_version: content.version,
        context: { source: "class", level: 1 },
      },
    ]);

    // Optional subclass content_ref — same shape handleSubclassSelect uses.
    if (subclassSlug) {
      const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
      if (subclassContent) {
        await supabase.from("character_content_refs").insert([
          {
            character_id: characterId,
            content_id: subclassContent.id,
            content_version: subclassContent.version,
            context: { source: "subclass", class: content.slug },
          },
        ]);
      }
    }

    startTransition(() => router.refresh());
  }

  async function handleLevelChange(classIndex: number, newLevel: number) {
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = { ...updatedClasses[classIndex], level: newLevel };
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    await supabase
      .from("characters")
      .update({ choices: newChoices, level: totalLevel })
      .eq("id", characterId);

    startTransition(() => router.refresh());
  }

  async function handleConfirmLevelUp(payload: { classIndex: number; draftLevel: number }) {
    const { classIndex, draftLevel } = payload;
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = { ...updatedClasses[classIndex], level: draftLevel };
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    await supabase
      .from("characters")
      .update({ choices: newChoices, level: totalLevel })
      .eq("id", characterId);

    startTransition(() => router.refresh());
  }

  function handleCancelLevelUp() {
    // No persistence — the rail handles UI revert; HP roll edits are already
    // persisted incrementally via handleHpRollChange (per Q2A semantics).
  }

  async function handleHpRollChange(key: string, record: HpRollRecord) {
    const newHpRolls = { ...(localChoices.hp_rolls ?? {}), [key]: record };
    const newChoices = { ...localChoices, hp_rolls: newHpRolls };
    setLocalChoices(newChoices);
    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  async function handleRemoveClass(classIndex: number) {
    const removedClass = selectedClasses[classIndex];
    const updatedClasses = selectedClasses.filter((_, i) => i !== classIndex);
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    setLocalChoices(newChoices);
    setLocalLevel(Math.max(totalLevel, 1));

    await supabase
      .from("characters")
      .update({ choices: newChoices, level: Math.max(totalLevel, 1) })
      .eq("id", characterId);

    // Remove content ref for this class
    const classContentRef = contentRefs.find(
      (ref) =>
        ref.content_definitions?.slug === removedClass.slug &&
        ref.content_definitions?.content_type === "class",
    );
    if (classContentRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", classContentRef.id);
    }

    startTransition(() => router.refresh());
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  async function handleFightingStyleSelect(
    featureSlug: string,
    classSlug: string,
    styleSlug: string | undefined,
  ) {
    // Save to resolved_choices
    const newResolved = {
      ...localChoices.resolved_choices,
      [featureSlug]: styleSlug ? [styleSlug] : [],
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove old fighting style content ref for this class
    const oldRef = contentRefs.find(
      (ref) =>
        ref.context?.source === "fighting_style" &&
        ref.context?.class === classSlug,
    );
    if (oldRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldRef.id);
    }

    // Create new content ref if a style is selected
    if (styleSlug) {
      const styleContent = features.find((f) => f.slug === styleSlug);
      if (styleContent) {
        await supabase.from("character_content_refs").insert([
          {
            character_id: characterId,
            content_id: styleContent.id,
            content_version: styleContent.version,
            context: { source: "fighting_style", class: classSlug },
          },
        ]);
      }
    }

    startTransition(() => router.refresh());
  }

  async function handleSubclassSelect(
    classSlug: string,
    classIndex: number,
    subclassSlug: string | undefined,
  ) {
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = {
      ...updatedClasses[classIndex],
      subclass: subclassSlug,
    };
    const newChoices = { ...localChoices, classes: updatedClasses };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Manage content ref for the subclass
    if (subclassSlug) {
      const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
      if (subclassContent) {
        // Remove any existing subclass ref for this class
        const existingRef = contentRefs.find(
          (ref) =>
            ref.content_definitions?.content_type === "subclass" &&
            ref.context?.source === "subclass" &&
            ref.context?.class === classSlug,
        );
        if (existingRef) {
          await supabase
            .from("character_content_refs")
            .delete()
            .eq("id", existingRef.id);
        }

        await supabase.from("character_content_refs").insert([
          {
            character_id: characterId,
            content_id: subclassContent.id,
            content_version: subclassContent.version,
            context: { source: "subclass", class: classSlug },
          },
        ]);
      }
    } else {
      // Remove subclass content ref
      const existingRef = contentRefs.find(
        (ref) =>
          ref.content_definitions?.content_type === "subclass" &&
          ref.context?.source === "subclass" &&
          ref.context?.class === classSlug,
      );
      if (existingRef) {
        await supabase
          .from("character_content_refs")
          .delete()
          .eq("id", existingRef.id);
      }
    }

    startTransition(() => router.refresh());
  }

  async function handleAsiSelect(featureSlug: string, choice: AsiChoice) {
    const newAsiChoices = {
      ...localChoices.asi_choices,
      [featureSlug]: choice,
    };
    const newChoices = { ...localChoices, asi_choices: newAsiChoices };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Class</h2>

        {hasClass ? (
          <ClassStepRail
            classes={classes}
            subclasses={subclasses}
            features={features}
            selectedClasses={selectedClasses}
            localChoices={localChoices}
            resolvedStats={resolvedStats}
            hpRule={hpRule}
            hpRolls={hpRolls}
            onLevelChange={handleLevelChange}
            onRemoveClass={handleRemoveClass}
            onSubclassSelect={handleSubclassSelect}
            onAsiSelect={handleAsiSelect}
            onFightingStyleSelect={handleFightingStyleSelect}
            onChoiceSelect={handleChoiceSelect}
            onAddClass={(content) => setPreviewContent(content)}
            onConfirmLevelUp={handleConfirmLevelUp}
            onCancelLevelUp={handleCancelLevelUp}
            onHpRollChange={handleHpRollChange}
          />
        ) : (
          <ContentBrowser
            entries={classes}
            contentTypeLabel="Class"
            onSelect={setPreviewContent}
          />
        )}

        <ClassPreviewModal
          open={previewContent !== null}
          classContent={previewContent}
          features={features}
          subclasses={subclasses}
          spells={spells}
          onCancel={() => setPreviewContent(null)}
          onPick={({ subclassSlug }) => {
            if (!previewContent) return;
            // classSlug from the modal == previewContent.slug. We pass the
            // full ContentEntry to keep the existing handler signature.
            handleSelectClass(previewContent, { subclassSlug });
          }}
        />

        {/* Bottom navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/characters/${characterId}/builder/race`)
            }
          >
            Previous: Race
          </Button>
          <Button
            onClick={() =>
              router.push(`/characters/${characterId}/builder/abilities`)
            }
          >
            Next: Abilities
          </Button>
        </div>
      </div>

      {/* Sidebar: StatPreview */}
      {schema && (
        <div className="hidden lg:block">
          <StatPreview
            baseStats={character.base_stats ?? {}}
            effects={allEffects}
            schema={schema}
            level={localLevel}
          />
        </div>
      )}
    </div>
  );
}
