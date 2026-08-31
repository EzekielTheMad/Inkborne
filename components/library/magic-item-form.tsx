"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createHomebrewMagicItem,
  updateHomebrewMagicItem,
  type HomebrewMagicItemActionState,
} from "@/app/(app)/homebrew/magic-items/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MagicItemData } from "@/lib/schemas/content-types/magic-item";
import { ITEM_RARITIES } from "@/lib/types/taxonomies";

interface MagicItemFormInitialValue {
  id: string;
  name: string;
  version: number;
  data: MagicItemData;
}

interface MagicItemFormProps {
  mode: "create" | "edit";
  initialValue?: MagicItemFormInitialValue;
}

interface MagicItemFormFields {
  name: string;
  rarity: MagicItemData["rarity"];
  description: string;
  equipmentCategory: string;
  requiresAttunement: boolean;
}

const emptyState: HomebrewMagicItemActionState = {
  status: "idle",
  message: "",
};
const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaClassName =
  "w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FieldErrors({
  state,
  name,
}: {
  state: HomebrewMagicItemActionState;
  name: string;
}) {
  const errors = state.fieldErrors?.[name];
  if (!errors?.length) return null;
  return (
    <p id={`magic-item-${name}-error`} className="text-xs text-destructive">
      {errors.join(" ")}
    </p>
  );
}

function errorAttributes(state: HomebrewMagicItemActionState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `magic-item-${name}-error` : undefined,
  } as const;
}

export function MagicItemForm({ mode, initialValue }: MagicItemFormProps) {
  const action = mode === "create" ? createHomebrewMagicItem : updateHomebrewMagicItem;
  const [state, formAction, pending] = useActionState(action, emptyState);
  const [fields, setFields] = useState<MagicItemFormFields>(() => ({
    name: initialValue?.name ?? "",
    rarity: initialValue?.data.rarity ?? "Common",
    description: initialValue?.data.description ?? "",
    equipmentCategory: initialValue?.data.equipment_category ?? "",
    requiresAttunement: initialValue?.data.requires_attunement ?? false,
  }));

  function setField<K extends keyof MagicItemFormFields>(
    key: K,
    value: MagicItemFormFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      action={formAction}
      onReset={(event) => event.preventDefault()}
      className="j-card-paper space-y-7 p-5 sm:p-7"
    >
      {initialValue && (
        <>
          <input type="hidden" name="id" value={initialValue.id} />
          <input type="hidden" name="expected_version" value={initialValue.version} />
        </>
      )}

      <fieldset className="space-y-4">
        <legend className="j-folio mb-3">Magic item details</legend>
        <div className="space-y-2">
          <Label htmlFor="magic-item-name">Name</Label>
          <Input
            id="magic-item-name"
            name="name"
            value={fields.name}
            onChange={(event) => setField("name", event.target.value)}
            maxLength={100}
            required
            {...errorAttributes(state, "name")}
          />
          <FieldErrors state={state} name="name" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="magic-item-rarity">Rarity</Label>
            <select
              id="magic-item-rarity"
              name="rarity"
              value={fields.rarity}
              onChange={(event) =>
                setField("rarity", event.target.value as MagicItemData["rarity"])
              }
              className={selectClassName}
              {...errorAttributes(state, "rarity")}
            >
              {ITEM_RARITIES.map((rarity) => (
                <option key={rarity} value={rarity}>{rarity}</option>
              ))}
            </select>
            <FieldErrors state={state} name="rarity" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="magic-item-equipment-category">Equipment category</Label>
            <Input
              id="magic-item-equipment-category"
              name="equipment_category"
              value={fields.equipmentCategory}
              onChange={(event) => setField("equipmentCategory", event.target.value)}
              maxLength={100}
              placeholder="Optional, such as Wondrous item"
              {...errorAttributes(state, "equipment_category")}
            />
            <FieldErrors state={state} name="equipment_category" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="magic-item-description">Magic item description</Label>
          <textarea
            id="magic-item-description"
            name="description"
            value={fields.description}
            onChange={(event) => setField("description", event.target.value)}
            rows={10}
            maxLength={20_000}
            className={textareaClassName}
            required
            {...errorAttributes(state, "description")}
          />
          <FieldErrors state={state} name="description" />
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <input
            id="magic-item-requires-attunement"
            name="requires_attunement"
            type="checkbox"
            checked={fields.requiresAttunement}
            onChange={(event) => setField("requiresAttunement", event.target.checked)}
            className="mt-0.5 size-4 rounded border-input accent-accent"
          />
          <div>
            <Label htmlFor="magic-item-requires-attunement">Requires attunement</Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Mark this when a character must attune before using the item.
            </p>
          </div>
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-border pt-5">
        {mode === "edit" && (
          <p className="text-sm text-muted-foreground">
            Changes create a new immutable version. Library readers discover the latest version.
          </p>
        )}
        {state.status !== "idle" && state.message && (
          <p role="alert" className="text-sm text-destructive">{state.message}</p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          {state.status === "conflict" && (
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Reload latest
            </Button>
          )}
          <Button
            type="submit"
            variant="gold"
            disabled={pending || state.status === "conflict"}
          >
            {pending
              ? "Saving..."
              : mode === "create"
                ? "Create private magic item"
                : "Save new version"}
          </Button>
        </div>
      </div>
    </form>
  );
}
