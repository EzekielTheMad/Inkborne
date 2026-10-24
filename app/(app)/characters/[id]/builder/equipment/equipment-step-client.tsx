"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateCharacter } from "@/lib/supabase/character-client";
import { confirmStartingEquipment } from "./actions";
import type { EquipmentRequest, StartingEquipmentCompletion } from "@/lib/builder/starting-equipment-contract";
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
import { markFirstArrival } from "@/components/sheet/first-arrival";
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
import type { SaveBuilderStep } from "@/lib/builder/builder-step-command";
import { useBuilderStepSave } from "@/components/builder/builder-save-boundary";

interface ContentSummary {
  id: string;
  name: string;
  slug: string;
  version: number;
  data: Record<string, unknown>;
}

interface EquipmentStepClientProps {
  incompleteSteps?: Array<{ type: string; label: string }>;
  saveAction?: SaveBuilderStep;
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
  completion?: StartingEquipmentCompletion;
}

export function EquipmentStepClient({
  characterId,
  character,
  classContent,
  backgroundContent,
  catalog,
  completion,
  saveAction: providedSaveAction,
  incompleteSteps,
}: EquipmentStepClientProps) {
  const saveAction = useBuilderStepSave(providedSaveAction);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const stored = character.choices?.starting_equipment;
  const isLegacyConfirmed = typeof stored === "string" && stored.length > 0;

  const [equipmentState, setEquipmentState] =
    useState<StartingEquipmentSelections>(
      isStructuredSelections(stored) ? stored : emptySelections(),
    );
  const saveBusy = useRef(false);
  const confirmationLocked = useRef(false);
  const selectionUnresolved = useRef(false);
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [canRecover, setCanRecover] = useState(false);
  const pendingRequest = useRef<EquipmentRequest | null>(null);
  const [receiptPlan, setReceiptPlan] = useState<ReturnType<typeof buildInventoryGrants> | null>(null);

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

  const confirmed = !!completion || !!equipmentState.confirmed;
  const needsDetails = incompleteSteps?.some(step => step.type === "details") ?? false;
  const incompleteBeforeDetails = incompleteSteps?.filter(step => step.type !== "details") ?? [];
  const complete = isSelectionComplete(groups, equipmentState, catalog);
  const hasUnavailablePicks = !complete && isSelectionComplete(groups, equipmentState);

  const grantPreview = useMemo(
    () =>
      receiptPlan ?? (confirmed ? buildInventoryGrants(groups, equipmentState, catalog) : null),
    [receiptPlan, confirmed, groups, equipmentState, catalog],
  );

  async function persistEquipmentState(next: StartingEquipmentSelections) {
    if (saveBusy.current || confirmationLocked.current) return;
    saveBusy.current = true;
    setIsSavingSelection(true);
    selectionUnresolved.current = false;
    setSelectionError(null);
    const prev = equipmentState;
    setEquipmentState(next);
    try {
      if (saveAction) {
        const saved = await saveAction("select_equipment", { selections: next.selections, picks: next.picks });
        const canonical = saved.choices.starting_equipment;
        if (!isStructuredSelections(canonical)) throw Error("The saved equipment selection was unavailable.");
        setEquipmentState(canonical);
      } else {
        await updateCharacter(characterId, { choices: { ...character.choices, starting_equipment: next } });
      }
    } catch (err) {
      setEquipmentState(prev);
      console.error("Failed to save equipment selection:", err);
      selectionUnresolved.current = true;
      setSelectionError("The equipment selection could not be confirmed. Check your connection and choose that option again before confirming.");
    } finally {
      saveBusy.current = false;
      setIsSavingSelection(false);
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

  async function handleConfirm(recover = false) {
    if (saveBusy.current || selectionUnresolved.current) return;
    if (!recover && (!complete || confirmed || confirmationLocked.current || !classContent)) return;
    if (recover && (!canRecover || !pendingRequest.current)) return;
    saveBusy.current = true;
    confirmationLocked.current = true;
    setIsConfirming(true);
    setConfirmError(null);
    setCanRecover(false);
    const request: EquipmentRequest = pendingRequest.current ?? {
      characterId, selections: equipmentState,
      sources: { class: { id: classContent!.id, version: classContent!.version },
        background: backgroundContent ? { id: backgroundContent.id, version: backgroundContent.version } : null },
    };
    pendingRequest.current = request;
    try {
      const result = await confirmStartingEquipment(request);
      if (result.status === "awarded") {
        setReceiptPlan(result.receipt.plan);
        setEquipmentState(prev => ({ ...prev, confirmed: true }));
        startTransition(() => router.refresh());
      } else if (result.status === "already_completed") {
        setEquipmentState(prev => ({ ...prev, confirmed: true }));
        startTransition(() => router.refresh());
      } else {
        setCanRecover(result.status === "uncertain" || result.status === "unavailable");
        setConfirmError(result.status === "not_eligible"
          ? "This character's earlier equipment grants need review before another award can be made."
          : result.status === "conflict"
            ? "The saved equipment changed or was already awarded with different selections. Reload before continuing."
            : "Equipment could not be confirmed. Check the saved award using the same selections before continuing.");
      }
    } catch {
      setCanRecover(true);
      setConfirmError("Equipment could not be confirmed. Check the saved award using the same selections before continuing.");
    } finally {
      saveBusy.current = false;
      setIsConfirming(false);
    }
  }

  const hasAnyEquipment = groups.length > 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Starting Equipment</h2>
      {isSavingSelection && <p role="status" className="text-sm text-muted-foreground">Saving equipment selection. Please wait.</p>}
      {selectionError && <p role="alert" className="text-sm text-destructive">{selectionError}</p>}

      {completion ? (
        <Card>
          <CardHeader><CardTitle>{completion.status === "awarded" ? "Starting equipment award recorded" : "Equipment completion inherited from the source character"}</CardTitle></CardHeader>
          <CardContent>
            {completion.status === "awarded" ? <>
              <ul className="space-y-1 text-sm">{completion.receipt.plan.items.map((item, index) => <li key={index}>{item.name}{item.quantity > 1 ? ` x${item.quantity}` : ""}</li>)}
                {Object.entries(completion.receipt.plan.currency).map(([unit, amount]) => <li key={unit}>{amount} {unit}</li>)}
              </ul>
              <p className="mt-2 text-sm">This is the original award record. Current inventory and currency may have changed.</p>
            </> : <p>No new equipment or currency was awarded by copying. Manage current items from the Inventory tab.</p>}
          </CardContent>
        </Card>
      ) : isLegacyConfirmed ? (
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
            disabled={confirmed || isConfirming || isSavingSelection || !!confirmError}
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
                onClick={() => void handleConfirm()}
                disabled={!complete || isConfirming || isSavingSelection || !!selectionError || !!confirmError}
              >
                {isConfirming ? "Adding to inventory…" : "Confirm Equipment"}
              </Button>
              {hasUnavailablePicks && <p role="alert" className="text-sm text-destructive">Some saved equipment picks are no longer available for their category. Choose from the current options before confirming.</p>}
              {!complete && (
                <p className="text-xs text-muted-foreground">
                  Make a selection in every group to confirm.
                </p>
              )}
              {canRecover && <Button variant="outline" disabled={isConfirming} onClick={() => void handleConfirm(true)}>Check saved equipment award</Button>}
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

      {!!incompleteSteps?.length && <div className="space-y-2 text-sm" role="status">
        <p>Complete these choices before finishing your character:</p>
        <ul className="list-disc pl-5">{incompleteSteps.map(step => <li key={step.type}>
          <Link className="underline" href={`/characters/${characterId}/builder/${step.type}`}>{step.label}</Link>
        </li>)}</ul>
      </div>}

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          disabled={isSavingSelection || isConfirming}
          onClick={() =>
            router.push(`/characters/${characterId}/builder/background`)
          }
        >
          Previous: Background
        </Button>
        <Button
          className="bg-character-fg text-background hover:opacity-90"
          disabled={isSavingSelection || isConfirming || (incompleteSteps !== undefined && (!!incompleteBeforeDetails.length || !confirmed))}
          onClick={() => {
            if (needsDetails) { router.push(`/characters/${characterId}/builder/details`); return; }
            // Let the sheet play its one-time arrival moment (M2 B4).
            markFirstArrival(characterId);
            router.push(`/characters/${characterId}`);
          }}
        >
          {needsDetails ? "Next: Character Details" : "Finish & View Character"}
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
