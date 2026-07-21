"use client";

import Link from "next/link";
import { CopyPlus, RefreshCw, ShieldAlert } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import {
  resolveMpmbImportConflict,
  type MpmbImportConflictActionState,
} from "@/app/(app)/library/import/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { MpmbImportConflictTarget } from "@/lib/supabase/mpmb-imports-server";
import { cn } from "@/lib/utils";

interface MpmbImportConflictResolutionFormProps {
  importId: string;
  itemId: string;
  revision: number;
  candidateName: string;
  conflicts: MpmbImportConflictTarget[];
  conflictResolution: "keep_both" | "replace" | null;
  replacementContentId: string | null;
  replacementExpectedVersion: number | null;
}

const initialState: MpmbImportConflictActionState = {
  status: "idle",
  message: "",
};

function selectionFor(
  resolution: MpmbImportConflictResolutionFormProps["conflictResolution"],
  replacementContentId: string | null,
): string {
  if (resolution === "keep_both") return "keep_both";
  if (resolution === "replace" && replacementContentId) {
    return `replace:${replacementContentId}`;
  }
  return "";
}

export function MpmbImportConflictResolutionForm({
  importId,
  itemId,
  revision,
  candidateName,
  conflicts,
  conflictResolution,
  replacementContentId,
  replacementExpectedVersion,
}: MpmbImportConflictResolutionFormProps) {
  const [state, formAction, pending] = useActionState(
    resolveMpmbImportConflict,
    initialState,
  );
  const [selection, setSelection] = useState(() =>
    selectionFor(conflictResolution, replacementContentId)
  );
  const selectedTarget = useMemo(
    () => conflicts.find((target) => selection === `replace:${target.id}`),
    [conflicts, selection],
  );
  const strategy = selection === "keep_both"
    ? "keep_both"
    : selectedTarget
      ? "replace"
      : "";
  const canSubmit = strategy === "keep_both"
    || (strategy === "replace" && selectedTarget?.replaceable === true);

  return (
    <form action={formAction} className="j-card-paper space-y-6 p-5 sm:p-7">
      <input type="hidden" name="import_id" value={importId} />
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="expected_revision" value={revision} />
      <input type="hidden" name="strategy" value={strategy} />
      <input
        type="hidden"
        name="target_content_id"
        value={selectedTarget?.id ?? ""}
      />
      <input
        type="hidden"
        name="target_content_version"
        value={selectedTarget?.version ?? replacementExpectedVersion ?? ""}
      />

      <fieldset className="space-y-3">
        <legend className="j-folio">Choose how to handle {candidateName}</legend>

        <label
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
            selection === "keep_both"
              ? "border-accent bg-accent/10"
              : "border-border hover:border-accent/50 hover:bg-muted/20",
          )}
        >
          <input
            type="radio"
            name="conflict_choice"
            value="keep_both"
            checked={selection === "keep_both"}
            onChange={(event) => setSelection(event.target.value)}
            className="mt-1 size-4 accent-[var(--accent)]"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CopyPlus className="size-4 text-accent" />
              Keep both
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Create a separate private definition. Inkborne will give the new
              copy a collision-safe internal slug.
            </span>
          </span>
        </label>

        {conflicts.map((target) => {
          const value = `replace:${target.id}`;
          const selected = selection === value;
          return (
            <label
              key={target.id}
              className={cn(
                "flex gap-3 rounded-lg border p-4 transition-colors",
                target.replaceable
                  ? "cursor-pointer hover:border-accent/50 hover:bg-muted/20"
                  : "cursor-not-allowed border-border/60 bg-muted/20 opacity-75",
                selected && "border-accent bg-accent/10",
              )}
            >
              <input
                type="radio"
                name="conflict_choice"
                value={value}
                checked={selected}
                disabled={!target.replaceable}
                onChange={(event) => setSelection(event.target.value)}
                className="mt-1 size-4 accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  <RefreshCw className="size-4 text-accent" />
                  Replace {target.name}
                  <Badge variant="outline">v{target.version}</Badge>
                  {target.previouslyImported && (
                    <Badge variant="secondary">Previously imported</Badge>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {target.replaceable
                    ? "Keep its stable ID and slug, then append the incoming rules as a new immutable version. Existing characters stay pinned to their chosen version."
                    : `Shared with ${target.sharedCampaignCount} ${target.sharedCampaignCount === 1 ? "campaign" : "campaigns"}. Unshare it first or keep both; Inkborne will not withdraw access automatically.`}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {strategy === "replace" && selectedTarget?.replaceable && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <ShieldAlert className="size-4" />
            Replacement is whole-definition and private
          </p>
          <p className="mt-1 leading-relaxed">
            The incoming normalized rules replace the current rules as a unit.
            The definition becomes import-derived and cannot be shared until a
            future rights workflow explicitly permits it.
          </p>
        </div>
      )}

      {state.status !== "idle" && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Link
          href={`/library/import/${importId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to review
        </Link>
        <Button type="submit" variant="gold" disabled={pending || !canSubmit}>
          {pending ? "Saving resolution..." : "Save resolution"}
        </Button>
      </div>
    </form>
  );
}
