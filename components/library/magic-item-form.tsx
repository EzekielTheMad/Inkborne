"use client";

import Link from "next/link";
import { useRouter, unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { z } from "zod";

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
import { acceptMagicItemResponse, magicItemUncertainty, magicItemVersionSchema } from "@/lib/homebrew/magic-item-form";

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
  const errors = state.status === "error" ? state.fieldErrors?.[name] : undefined;
  if (!errors?.length) return null;
  return (
    <p id={`magic-item-${name}-error`} className="text-xs text-destructive">
      {errors.join(" ")}
    </p>
  );
}

function errorAttributes(state: HomebrewMagicItemActionState, name: string) {
  const invalid = state.status === "error" && Boolean(state.fieldErrors?.[name]?.length);
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `magic-item-${name}-error` : undefined,
  } as const;
}

function preserveFormDraft(form: HTMLFormElement | null) {
  if (!form) return;
  // React resets action forms during its commit, when delegated onReset
  // handlers are suppressed. Keep the native reset from discarding drafts.
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}

export function MagicItemForm({ mode, initialValue }: MagicItemFormProps) {
  const router = useRouter();
  const [mounted] = useState(() => ({ mode, id: initialValue?.id, version: initialValue?.version }));
  const [acknowledged, setAcknowledged] = useState(false);
  const submitted = useRef(false);
  const retained = useRef<HomebrewMagicItemActionState>(emptyState);
  const summary = useRef<HTMLParagraphElement>(null);
  const drift = mode !== mounted.mode || initialValue?.id !== mounted.id || initialValue?.version !== mounted.version;
  const identityReady = mounted.mode === "create" || (z.uuid().safeParse(mounted.id).success && magicItemVersionSchema.safeParse(mounted.version).success);
  const action = mounted.mode === "create" ? createHomebrewMagicItem : updateHomebrewMagicItem;
  const [state, formAction, pending] = useActionState(async (_previous: HomebrewMagicItemActionState, form: FormData) => {
    if (drift || !identityReady || ["saved", "conflict", "uncertain"].includes(retained.current.status)) {
      submitted.current = false;
      return retained.current.status === "idle" ? magicItemUncertainty(mounted.mode) : retained.current;
    }
    let result: HomebrewMagicItemActionState;
    try { result = acceptMagicItemResponse(await action(_previous, form), mounted.mode, mounted.id, mounted.version); }
    catch (error) { unstable_rethrow(error); result = magicItemUncertainty(mounted.mode); }
    finally { submitted.current = false; }
    retained.current = result;
    setAcknowledged(false);
    // Retain the exact acknowledgment before navigation; a failed push must not reinsert.
    if (result.status === "saved") {
      try { router.push("/homebrew"); }
      catch (error) {
        unstable_rethrow(error);
        result = { ...result, message: "The exact saved version is confirmed. Navigation failed; use Check Homebrew rather than repeating this save." };
        retained.current = result;
      }
    }
    return result;
  }, emptyState);
  const blocked = drift || !identityReady || state.status === "saved" || state.status === "conflict"
    || (state.status === "uncertain" && !(mounted.mode === "create" && acknowledged));
  useEffect(() => {
    if (state.status !== "error") return;
    const ids: Record<string, string> = { name: "magic-item-name", rarity: "magic-item-rarity", description: "magic-item-description",
      equipment_category: "magic-item-equipment-category", requires_attunement: "magic-item-requires-attunement" };
    const key = Object.keys(state.fieldErrors ?? {}).find(key => ids[key]);
    const field = key ? document.getElementById(ids[key]) : null;
    (field ?? summary.current)?.focus();
  }, [state]);
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
      ref={preserveFormDraft}
      onSubmit={(event) => {
        if (submitted.current || pending || blocked) { event.preventDefault(); return; }
        submitted.current = true;
      }}
      className="j-card-paper space-y-7 p-5 sm:p-7"
    >
      {mounted.mode === "edit" && (
        <>
          <input type="hidden" name="id" value={mounted.id ?? ""} />
          <input type="hidden" name="expected_version" value={mounted.version ?? ""} />
        </>
      )}

      <fieldset className="space-y-4" disabled={pending || blocked} aria-busy={pending}>
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
            {...errorAttributes(state, "requires_attunement")}
          />
          <div>
            <Label htmlFor="magic-item-requires-attunement">Requires attunement</Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Mark this when a character must attune before using the item.
            </p>
            <FieldErrors state={state} name="requires_attunement" />
          </div>
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-border pt-5">
        {mounted.mode === "edit" && (
          <p className="text-sm text-muted-foreground">
            Changes create a new immutable version. Library readers discover the latest version.
          </p>
        )}
        {(drift || !identityReady) && <p role="alert">This form's identity or version changed. Your draft is kept. Reload to discard it and load the current record.</p>}
        {state.status !== "idle" && state.message && (
          <p ref={summary} tabIndex={-1} role="alert" className="text-sm text-destructive">{state.message}</p>
        )}
        {state.status === "saved" && <p role="status">Saved exact magic-item version {state.version} ({state.id}). Later versions or sharing changes may exist.</p>}
        {state.status === "uncertain" && mounted.mode === "create" && <div className="space-y-2">
          <p>A lost response may still have created the item. Check your owned Homebrew before allowing another create; a second attempt can create a duplicate. Leaving this page can discard the draft.</p>
          <Button type="button" variant="outline" disabled={pending || drift || acknowledged} onClick={() => {
            retained.current = emptyState; setAcknowledged(true);
          }}>I checked; allow another create</Button>
        </div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          {(state.status === "saved" || state.status === "uncertain") && <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Check Homebrew</Link>}
          {(drift || !identityReady || state.status === "conflict" || (state.status === "uncertain" && mounted.mode === "edit")) && (
            <div className="space-y-1">
            <p className="text-xs">Reload discards this unsaved draft.</p>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Reload latest
            </Button>
            </div>
          )}
          <Button
            type="submit"
            variant="gold"
            disabled={pending || blocked}
          >
            {pending
              ? "Saving..."
              : mounted.mode === "create"
                ? "Create private magic item"
                : "Save new version"}
          </Button>
        </div>
      </div>
    </form>
  );
}
