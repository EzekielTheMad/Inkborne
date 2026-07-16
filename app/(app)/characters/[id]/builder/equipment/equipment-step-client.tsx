"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCharacter } from "@/lib/supabase/character-client";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { addInventoryItem } from "@/lib/supabase/inventory";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EquipmentChooser } from "@/components/builder/equipment-chooser";
import {
  buildInventoryGrants,
  emptySelections,
  isSelectionComplete,
  isStructuredSelections,
  parseEquipmentGroups,
  type EquipmentCatalogItem,
} from "@/lib/builder/equipment-choices";
import type {
  CharacterChoices,
  StartingEquipmentSelections,
} from "@/lib/types/character";
import type { Currency } from "@/lib/types/inventory";
import { DEFAULT_CURRENCY } from "@/lib/types/inventory";

interface ContentSummary {
  id: string;
  name: string;
  slug: string;
  data: Record<string, unknown>;
}

interface EquipmentStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    choices: CharacterChoices;
    state: { currency?: Currency } | null;
  };
  classContent: ContentSummary | null;
  backgroundContent: ContentSummary | null;
  catalog: EquipmentCatalogItem[];
}

export function EquipmentStepClient({
  characterId,
  character,
  classContent,
  backgroundContent,
  catalog,
}: EquipmentStepClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const stored = character.choices?.starting_equipment;
  const isLegacyConfirmed = typeof stored === "string" && stored.length > 0;

  const [equipmentState, setEquipmentState] =
    useState<StartingEquipmentSelections>(
      isStructuredSelections(stored) ? stored : emptySelections(),
    );
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const classText = classContent?.data?.equipment as string | undefined;
  const backgroundText = backgroundContent?.data?.equipment as string | undefined;
  const startingGold = classContent?.data?.starting_gold as string | undefined;

  const groups = useMemo(
    () =>
      parseEquipmentGroups({
        classText: classText ?? null,
        backgroundText: backgroundText ?? null,
      }),
    [classText, backgroundText],
  );

  const confirmed = !!equipmentState.confirmed;
  const complete = isSelectionComplete(groups, equipmentState);

  const grantPreview = useMemo(
    () =>
      confirmed ? buildInventoryGrants(groups, equipmentState, catalog) : null,
    [confirmed, groups, equipmentState, catalog],
  );

  async function persistEquipmentState(next: StartingEquipmentSelections) {
    const prev = equipmentState;
    setEquipmentState(next);
    try {
      await updateCharacter(characterId, {
        choices: { ...character.choices, starting_equipment: next },
      });
    } catch (err) {
      setEquipmentState(prev);
      console.error("Failed to save equipment selection:", err);
    }
  }

  function handleSelectOption(groupKey: string, optionId: string) {
    if (confirmed) return;
    void persistEquipmentState({
      ...equipmentState,
      selections: { ...equipmentState.selections, [groupKey]: optionId },
    });
  }

  function handlePick(slotKey: string, value: string) {
    if (confirmed) return;
    void persistEquipmentState({
      ...equipmentState,
      picks: { ...equipmentState.picks, [slotKey]: value },
    });
  }

  async function handleConfirm() {
    if (!complete || confirmed || isConfirming) return;
    setIsConfirming(true);
    setConfirmError(null);

    try {
      const { items, currency } = buildInventoryGrants(
        groups,
        equipmentState,
        catalog,
      );

      // Sequential inserts keep sort_order deterministic; addInventoryItem
      // resolves null (and logs) on failure rather than throwing.
      const failures: string[] = [];
      for (const grant of items) {
        const inserted = await addInventoryItem(characterId, {
          content_id: grant.content_id,
          name: grant.name,
          content_type: grant.content_type,
          quantity: grant.quantity,
        });
        if (!inserted) failures.push(grant.name);
      }
      if (failures.length > 0) {
        throw new Error(`Could not add: ${failures.join(", ")}`);
      }

      if (Object.keys(currency).length > 0) {
        const current = character.state?.currency ?? DEFAULT_CURRENCY;
        const merged: Currency = { ...DEFAULT_CURRENCY, ...current };
        for (const [unit, amount] of Object.entries(currency)) {
          merged[unit as keyof Currency] += amount;
        }
        await updateCharacterState(characterId, { currency: merged });
      }

      const confirmedState: StartingEquipmentSelections = {
        ...equipmentState,
        confirmed: true,
      };
      await updateCharacter(characterId, {
        choices: { ...character.choices, starting_equipment: confirmedState },
      });
      setEquipmentState(confirmedState);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Failed to confirm equipment:", err);
      setConfirmError(
        err instanceof Error
          ? err.message
          : "Something went wrong while granting equipment.",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  const hasAnyEquipment = groups.length > 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Starting Equipment</h2>

      {isLegacyConfirmed ? (
        <LegacyConfirmedNotice classText={classText} backgroundText={backgroundText} />
      ) : hasAnyEquipment ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {classContent
              ? `Your ${classContent.name} starts with the following equipment. `
              : ""}
            Pick one option in each group
            {backgroundContent ? ` — your ${backgroundContent.name} background adds a few items too` : ""}
            .
          </p>

          <EquipmentChooser
            groups={groups}
            catalog={catalog}
            selections={equipmentState.selections}
            picks={equipmentState.picks}
            disabled={confirmed || isConfirming}
            onSelectOption={handleSelectOption}
            onPick={handlePick}
          />

          {startingGold && !confirmed && (
            <p className="text-sm text-muted-foreground">
              Alternatively, you can start with{" "}
              <span className="font-medium">{startingGold}</span> and buy your
              own equipment (not yet supported — coming later).
            </p>
          )}

          {!confirmed ? (
            <div className="space-y-2">
              <Button
                onClick={handleConfirm}
                disabled={!complete || isConfirming}
              >
                {isConfirming ? "Adding to inventory…" : "Confirm Equipment"}
              </Button>
              {!complete && (
                <p className="text-xs text-muted-foreground">
                  Make a selection in every group to confirm.
                </p>
              )}
              {confirmError && (
                <p className="text-xs text-destructive" role="alert">
                  {confirmError}
                </p>
              )}
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Confirmed</Badge>
                  <CardTitle className="text-base">Added to inventory</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {grantPreview?.items.map((item) => (
                    <li key={`${item.content_id ?? item.name}`}>
                      {item.name}
                      {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                    </li>
                  ))}
                  {grantPreview &&
                    Object.entries(grantPreview.currency).map(
                      ([unit, amount]) => (
                        <li key={unit}>
                          {amount} {unit}
                        </li>
                      ),
                    )}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Manage items from the Inventory tab on the character sheet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipment</CardTitle>
            <CardDescription>
              {classContent
                ? "No starting equipment defined for this class."
                : "Select a class first to see starting equipment options."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Separator />

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/characters/${characterId}/builder/background`)
          }
        >
          Previous: Background
        </Button>
        <Button
          className="bg-character-fg text-background hover:opacity-90"
          onClick={() => router.push(`/characters/${characterId}`)}
        >
          Finish &amp; View Character
        </Button>
      </div>
    </div>
  );
}

/** Characters confirmed through the old acknowledge-only flow: show the
 *  equipment text read-only; no re-grant path (inventory may already be set up). */
function LegacyConfirmedNotice({
  classText,
  backgroundText,
}: {
  classText: string | undefined;
  backgroundText: string | undefined;
}) {
  const lines = [
    ...(classText ? classText.split(";").map((s) => s.trim()) : []),
    ...(backgroundText ? [backgroundText.trim()] : []),
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">Confirmed</Badge>
        Equipment was confirmed for this character. Manage items from the
        Inventory tab on the character sheet.
      </div>
      {lines.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            {lines.map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
