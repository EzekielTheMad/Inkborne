"use client";

import { Check, Minus } from "lucide-react";
import { useActionState } from "react";

import {
  toggleMpmbImportItem,
  type MpmbImportActionState,
} from "@/app/(app)/library/import/actions";
import { Button } from "@/components/ui/button";

const initialState: MpmbImportActionState = { status: "idle" };

interface MpmbImportSelectionButtonProps {
  importId: string;
  itemId: string;
  revision: number;
  selected: boolean;
}

export function MpmbImportSelectionButton({
  importId,
  itemId,
  revision,
  selected,
}: MpmbImportSelectionButtonProps) {
  const [state, formAction, pending] = useActionState(
    toggleMpmbImportItem,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="import_id" value={importId} />
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="expected_revision" value={revision} />
      <input type="hidden" name="selected" value={String(!selected)} />
      <Button type="submit" size="sm" variant={selected ? "secondary" : "outline"} disabled={pending}>
        {selected ? <Check className="size-3.5" /> : <Minus className="size-3.5" />}
        {pending ? "Saving..." : selected ? "Selected" : "Skipped"}
      </Button>
      {state.status !== "idle" && state.status !== "success" && (
        <span role="alert" className="max-w-56 text-right text-[11px] leading-tight text-destructive">
          {state.message}
        </span>
      )}
    </form>
  );
}
