"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateCharacter,
  updateCharacterAndReturn,
} from "@/lib/supabase/character-client";
import {
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs-client";
import { Button } from "@/components/ui/button";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ClassPreviewModal } from "@/components/builder/class-preview-modal";
import { ClassStepRail } from "@/components/builder/class-step-rail";
import { StatPreview } from "@/components/builder/stat-preview";
import type {
  CharacterChoices,
  AsiChoice,
  HpRollRecord,
  UsableFeatOption,
} from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { resolveHpRule, type HpRule } from "@/lib/builder/level-up-rules";
import type { Effect } from "@/lib/types/effects";
import { evaluate } from "@/lib/engine/evaluator";
import {
  searchUsableFeatsAction,
  setCharacterAsiChoiceAction,
} from "./actions";

interface ClassStepClientProps {
  characterId: string;
  character: {
    id: string;
    name: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  classes: ContentEntry[];
  subclasses: ContentEntry[];
  features: ContentEntry[];
  feats: UsableFeatOption[];
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
  feats,
  spells,
  contentRefs,
  schema,
}: ClassStepClientProps) {
  const router = useRouter();
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

    const prev = { choices: localChoices, level: localLevel };
    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    try {
      const persisted = await updateCharacterAndReturn(characterId, {
        choices: newChoices,
        level: totalLevel,
      });
      setLocalChoices(persisted.choices);
      setLocalLevel(persisted.level);
      await insertContentRef({
        characterId,
        contentId: content.id,
        contentVersion: content.version,
        context: { source: "class", level: 1 },
      });
      if (subclassSlug) {
        const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
        if (subclassContent) {
          await insertContentRef({
            characterId,
            contentId: subclassContent.id,
            contentVersion: subclassContent.version,
            context: { source: "subclass", class: content.slug },
          });
        }
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev.choices);
      setLocalLevel(prev.level);
      console.error("Failed to add class:", err);
    }
  }

  async function handleLevelChange(classIndex: number, newLevel: number) {
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = {
      ...updatedClasses[classIndex],
      level: newLevel,
    };
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    const prev = { choices: localChoices, level: localLevel };
    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    try {
      const persisted = await updateCharacterAndReturn(characterId, {
        choices: newChoices,
        level: totalLevel,
      });
      setLocalChoices(persisted.choices);
      setLocalLevel(persisted.level);
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev.choices);
      setLocalLevel(prev.level);
      console.error("Failed to change class level:", err);
    }
  }

  async function handleConfirmLevelUp(payload: {
    classIndex: number;
    draftLevel: number;
  }) {
    const { classIndex, draftLevel } = payload;
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = {
      ...updatedClasses[classIndex],
      level: draftLevel,
    };
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    const prev = { choices: localChoices, level: localLevel };
    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    try {
      const persisted = await updateCharacterAndReturn(characterId, {
        choices: newChoices,
        level: totalLevel,
      });
      setLocalChoices(persisted.choices);
      setLocalLevel(persisted.level);
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev.choices);
      setLocalLevel(prev.level);
      console.error("Failed to confirm level up:", err);
    }
  }

  function handleCancelLevelUp() {
    // No persistence — the rail handles UI revert; HP roll edits are already
    // persisted incrementally via handleHpRollChange (per Q2A semantics).
  }

  async function handleHpRollChange(key: string, record: HpRollRecord) {
    const newHpRolls = { ...(localChoices.hp_rolls ?? {}), [key]: record };
    const newChoices = { ...localChoices, hp_rolls: newHpRolls };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save HP roll:", err);
    }
  }

  async function handleRemoveClass(classIndex: number) {
    const removedClass = selectedClasses[classIndex];
    const updatedClasses = selectedClasses.filter((_, i) => i !== classIndex);
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };
    const newLevel = Math.max(totalLevel, 1);

    const prev = { choices: localChoices, level: localLevel };
    setLocalChoices(newChoices);
    setLocalLevel(newLevel);

    try {
      const persisted = await updateCharacterAndReturn(characterId, {
        choices: newChoices,
        level: newLevel,
      });
      setLocalChoices(persisted.choices);
      setLocalLevel(persisted.level);
      const classContentRef = contentRefs.find(
        (ref) =>
          ref.content_definitions?.slug === removedClass.slug &&
          ref.content_definitions?.content_type === "class",
      );
      if (classContentRef) {
        await removeContentRefById(classContentRef.id);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev.choices);
      setLocalLevel(prev.level);
      console.error("Failed to remove class:", err);
    }
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save choice selection:", err);
    }
  }

  async function handleFightingStyleSelect(
    featureSlug: string,
    classSlug: string,
    styleSlug: string | undefined,
  ) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [featureSlug]: styleSlug ? [styleSlug] : [],
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });

      const oldRef = contentRefs.find(
        (ref) =>
          ref.context?.source === "fighting_style" &&
          ref.context?.class === classSlug,
      );
      if (oldRef) {
        await removeContentRefById(oldRef.id);
      }

      if (styleSlug) {
        const styleContent = features.find((f) => f.slug === styleSlug);
        if (styleContent) {
          await insertContentRef({
            characterId,
            contentId: styleContent.id,
            contentVersion: styleContent.version,
            context: { source: "fighting_style", class: classSlug },
          });
        }
      }

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save fighting style:", err);
    }
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

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });

      const existingRef = contentRefs.find(
        (ref) =>
          ref.content_definitions?.content_type === "subclass" &&
          ref.context?.source === "subclass" &&
          ref.context?.class === classSlug,
      );

      if (subclassSlug) {
        const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
        if (subclassContent) {
          if (existingRef) {
            await removeContentRefById(existingRef.id);
          }
          await insertContentRef({
            characterId,
            contentId: subclassContent.id,
            contentVersion: subclassContent.version,
            context: { source: "subclass", class: classSlug },
          });
        }
      } else if (existingRef) {
        await removeContentRefById(existingRef.id);
      }

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save subclass:", err);
    }
  }

  async function handleAsiSelect(featureSlug: string, choice: AsiChoice) {
    const newAsiChoices = {
      ...localChoices.asi_choices,
      [featureSlug]: choice,
    };
    const newChoices = { ...localChoices, asi_choices: newAsiChoices };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      const result = await setCharacterAsiChoiceAction({
        characterId,
        featureSlug,
        choice: choice.mode === "feat"
          ? {
              mode: choice.mode,
              featId: choice.featId,
              featVersion: choice.featVersion,
            }
          : choice,
      });
      if (result.status !== "success") {
        throw new Error(result.message);
      }
      setLocalChoices(result.choices);
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save ASI selection:", err);
      throw err;
    }
  }

  const handleFeatSearch = useCallback(async (featureSlug: string, query: string) => {
    const result = await searchUsableFeatsAction({
      characterId,
      featureSlug,
      query,
    });
    if (result.status !== "success") {
      throw new Error(result.message);
    }
    return result.feats;
  }, [characterId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6 min-w-0">
        <h2 className="text-xl font-semibold">Class</h2>

        {hasClass ? (
          <ClassStepRail
            characterName={character.name}
            classes={classes}
            subclasses={subclasses}
            features={features}
            feats={feats}
            onFeatSearch={handleFeatSearch}
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
            className="bg-character-fg text-background hover:opacity-90"
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
