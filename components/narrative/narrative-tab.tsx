"use client";

import { useCallback } from "react";
import type { CharacterWithSystem } from "@/lib/types/character";
import {
  uploadPortrait,
  uploadToken,
  deletePortrait,
  deleteToken,
} from "@/app/(app)/characters/[id]/narrative-actions";
import { Button } from "@/components/ui/button";
import { Pencil, X, Save, Loader2, Check } from "lucide-react";

import { useNarrativeEditor, type SaveStatus } from "./use-narrative-editor";

// View components
import { CoreIdentityCard } from "./view/core-identity-card";
import { PersonalityCard } from "./view/personality-card";
import { BackstoryCard } from "./view/backstory-card";
import { DistinguishingFeaturesCard } from "./view/distinguishing-features-card";
import { FunTraitsCard } from "./view/fun-traits-card";

// Edit components
import { CoreIdentityForm } from "./edit/core-identity-form";
import { PersonalityForm } from "./edit/personality-form";
import { BackstoryForm } from "./edit/backstory-form";
import { DistinguishingFeaturesForm } from "./edit/distinguishing-features-form";
import { FunTraitsForm } from "./edit/fun-traits-form";

// Portrait
import { CharacterPortrait } from "./character-portrait";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NarrativeTabProps {
  character: CharacterWithSystem;
  campaignId?: string | null;
  isOwner: boolean;
  isDm: boolean;
  onPortraitChange?: (url: string | null) => void;
  onCropChange?: (crop: { x: number; y: number; width: number; height: number }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NarrativeTab({
  character,
  campaignId,
  isOwner,
  isDm,
  onPortraitChange: onPortraitChangeParent,
  onCropChange: onCropChangeParent,
}: NarrativeTabProps) {
  const editor = useNarrativeEditor({
    character,
    onPortraitChange: onPortraitChangeParent,
  });

  const {
    editMode,
    enterEdit,
    savedNarrative,
    savedRich,
    savedChoices,
    localNarrative,
    localRich,
    localChoices,
    setLocalNarrative,
    saveStatus,
    portraitUrl,
    tokenUrl,
    handleNarrativeChange,
    handleFunTraitChange,
    handleRichChange,
    handleChoiceChange,
    handlePortraitChange,
    handleTokenChange,
    handleManualSave,
    handleCancel,
    markNarrativeDirty,
    scheduleAutoSave,
  } = editor;

  // ---- Portrait upload/delete wrappers (passed straight to CharacterPortrait) ----
  const handleUpload = useCallback(
    async (formData: FormData) => {
      const file = formData.get("file") as File | null;
      const type = formData.get("type") as string;
      if (!file) return { error: "No file" };

      const fd = new FormData();
      fd.set(type === "token" ? "token" : "portrait", file);

      const result =
        type === "token"
          ? await uploadToken(character.id, fd)
          : await uploadPortrait(character.id, fd);

      if ("url" in result) {
        return { success: true, url: result.url };
      }
      return result;
    },
    [character.id],
  );

  const handleDelete = useCallback(
    async (_characterId: string, type: "portrait" | "token") => {
      const result =
        type === "token"
          ? await deleteToken(character.id)
          : await deletePortrait(character.id);
      return result;
    },
    [character.id],
  );

  // ---- Determine if view has any content ----
  const narrative = editMode ? localNarrative : savedNarrative;
  const rich = editMode ? localRich : savedRich;
  const choices = editMode ? localChoices : savedChoices;

  const hasAnyViewContent =
    narrative.full_name ||
    narrative.aliases ||
    narrative.one_liner ||
    narrative.age ||
    narrative.build ||
    narrative.origin ||
    narrative.motivation ||
    narrative.mannerisms ||
    narrative.fear ||
    (choices.personality_traits && choices.personality_traits.length > 0) ||
    (choices.ideals && choices.ideals.length > 0) ||
    (choices.bonds && choices.bonds.length > 0) ||
    (choices.flaws && choices.flaws.length > 0) ||
    rich.distinguishing_features ||
    rich.backstory_origin ||
    rich.backstory_turning_point ||
    rich.backstory_left_behind ||
    rich.backstory_dm_notes ||
    (narrative.fun_traits &&
      Object.values(narrative.fun_traits).some(Boolean)) ||
    portraitUrl ||
    tokenUrl;

  // ---- Render ----
  return (
    <div className="space-y-4">
      {/* Header row: title + action buttons */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <SaveStatusBadge status={saveStatus} />
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="mr-1 size-3.5" />
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleManualSave}
                disabled={saveStatus === "saving"}
              >
                <Save className="mr-1 size-3.5" />
                {saveStatus === "saving" ? "Saving..." : "Save"}
              </Button>
            </>
          )}
          {isOwner && !editMode && (
            <Button onClick={enterEdit}>
              <Pencil className="mr-1 size-4" />
              Edit Character
            </Button>
          )}
        </div>
      </div>

      {/* Portrait + Core Identity — side by side */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex-shrink-0">
          <CharacterPortrait
            characterId={character.id}
            characterName={character.name}
            portraitUrl={portraitUrl}
            tokenUrl={tokenUrl}
            portraitCrop={localNarrative.portrait_crop as { x: number; y: number; width: number; height: number } | undefined}
            editable={editMode}
            onPortraitChange={handlePortraitChange}
            onTokenChange={handleTokenChange}
            onCropChange={(crop) => {
              setLocalNarrative((prev) => ({ ...prev, portrait_crop: crop }));
              markNarrativeDirty();
              scheduleAutoSave();
              onCropChangeParent?.(crop);
            }}
            uploadAction={handleUpload}
            deleteAction={handleDelete}
          />
        </div>
        <div className="flex-1 w-full">
          {editMode ? (
            <CoreIdentityForm
              narrative={localNarrative}
              onChange={handleNarrativeChange}
            />
          ) : (
            <CoreIdentityCard narrative={narrative} />
          )}
        </div>
      </div>

      {/* Edit mode */}
      {editMode && (
        <div className="space-y-4">
          <PersonalityForm
            choices={localChoices}
            narrative={localNarrative}
            onChoiceChange={handleChoiceChange}
            onNarrativeChange={handleNarrativeChange}
          />
          <DistinguishingFeaturesForm
            content={localRich.distinguishing_features ?? null}
            campaignId={campaignId}
            onChange={(content) =>
              handleRichChange("distinguishing_features", content)
            }
          />
          <BackstoryForm
            narrativeRich={localRich}
            campaignId={campaignId}
            onRichChange={handleRichChange}
            isOwner={isOwner}
          />
          <FunTraitsForm
            funTraits={localNarrative.fun_traits}
            onChange={handleFunTraitChange}
          />
        </div>
      )}

      {/* View mode */}
      {!editMode && (
        <>
          {hasAnyViewContent ? (
            <div className="space-y-4">
              <PersonalityCard choices={choices} narrative={narrative} />
              <DistinguishingFeaturesCard
                content={rich.distinguishing_features}
                campaignId={campaignId}
              />
              <BackstoryCard
                title="Where They Came From"
                content={rich.backstory_origin}
                campaignId={campaignId}
              />
              <BackstoryCard
                title="The Turning Point"
                content={rich.backstory_turning_point}
                campaignId={campaignId}
              />
              <BackstoryCard
                title="What They Left Behind"
                content={rich.backstory_left_behind}
                campaignId={campaignId}
              />
              {(isOwner || isDm) && (
                <BackstoryCard
                  title="What the DM Should Know"
                  content={rich.backstory_dm_notes}
                  dmOnly
                  campaignId={campaignId}
                />
              )}
              <FunTraitsCard funTraits={narrative.fun_traits} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-muted-foreground">
                No narrative details yet.
              </p>
              {isOwner && (
                <p className="text-sm text-muted-foreground">
                  Click <span className="font-medium text-foreground">Edit</span>{" "}
                  to bring your character to life.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save status badge
// ---------------------------------------------------------------------------

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" />
          Saving...
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3 text-green-500" />
          Saved
        </>
      )}
      {status === "error" && (
        <span className="text-destructive">Save failed</span>
      )}
    </span>
  );
}
