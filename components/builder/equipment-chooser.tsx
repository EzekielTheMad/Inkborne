"use client";

import { CheckIcon } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getActiveOption,
  getCategoryChoices,
  getOptionCategorySlots,
  type CategorySlot,
  type EquipmentCatalogItem,
  type EquipmentGroup,
} from "@/lib/builder/equipment-choices";

interface EquipmentChooserProps {
  groups: EquipmentGroup[];
  catalog: EquipmentCatalogItem[];
  selections: Record<string, string>;
  picks: Record<string, string>;
  /** Locks all inputs (after equipment has been confirmed). */
  disabled?: boolean;
  onSelectOption: (groupKey: string, optionId: string) => void;
  onPick: (slotKey: string, value: string) => void;
}

/**
 * Renders starting-equipment groups as selectable option cards. Choice groups
 * are radio-style (one option per group); fixed groups render as granted rows.
 * Category placeholders ("any simple weapon") expose a dropdown per pick.
 */
export function EquipmentChooser({
  groups,
  catalog,
  selections,
  picks,
  disabled = false,
  onSelectOption,
  onPick,
}: EquipmentChooserProps) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <EquipmentGroupCard
          key={group.key}
          group={group}
          catalog={catalog}
          selections={selections}
          picks={picks}
          disabled={disabled}
          onSelectOption={onSelectOption}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function EquipmentGroupCard({
  group,
  catalog,
  selections,
  picks,
  disabled,
  onSelectOption,
  onPick,
}: {
  group: EquipmentGroup;
  catalog: EquipmentCatalogItem[];
  selections: Record<string, string>;
  picks: Record<string, string>;
  disabled: boolean;
  onSelectOption: (groupKey: string, optionId: string) => void;
  onPick: (slotKey: string, value: string) => void;
}) {
  const activeOption = getActiveOption(group, selections);
  const id = useId();
  const slots = activeOption ? getOptionCategorySlots(group, activeOption) : [];

  return (
    <article className="rounded-md border border-border bg-card/40 p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">
          {group.kind === "choice" ? "Choose one" : "You receive"}
        </h4>
        <Badge variant="outline" className="shrink-0 text-xs capitalize">
          {group.source}
        </Badge>
      </header>

      {group.kind === "choice" ? (
        <div className="space-y-1" role="group" aria-label={group.label}>
          <label htmlFor={id} className="text-sm text-muted-foreground">{group.label}</label>
          <select id={id} disabled={disabled || group.options.length === 0} value={activeOption?.id ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={event => {
              const option = group.options.find(candidate => candidate.id === event.target.value);
              if (!disabled && option) onSelectOption(group.key, option.id);
            }}>
            <option value="">Choose equipment…</option>
            {group.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          {!!selections[group.key] && !activeOption && <p role="alert" className="text-sm text-destructive">The saved equipment choice is unavailable. Choose an available replacement.</p>}
        </div>
      ) : (
        <div className="flex items-start gap-2 text-sm">
          <CheckIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-character-fg"
          />
          <p>{group.options[0]?.label}</p>
        </div>
      )}

      {slots.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {slots.map((slot) => (
            <CategorySlotSelect
              key={slot.key}
              slot={slot}
              catalog={catalog}
              value={picks[slot.key]}
              disabled={disabled}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function CategorySlotSelect({
  slot,
  catalog,
  value,
  disabled,
  onPick,
}: {
  slot: CategorySlot;
  catalog: EquipmentCatalogItem[];
  value: string | undefined;
  disabled: boolean;
  onPick: (slotKey: string, value: string) => void;
}) {
  const choices = getCategoryChoices(slot.category, catalog);
  const items = choices.map((c) => ({ value: c.value, label: c.label }));

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`equipment-slot-${slot.key}`}
        className="text-xs font-medium text-muted-foreground"
      >
        {slot.label}
      </label>
      <Select
        items={items}
        value={value ?? null}
        onValueChange={(next) => {
          if (!disabled && typeof next === "string" && choices.some(choice => choice.value === next)) onPick(slot.key, next);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={`equipment-slot-${slot.key}`}
          aria-label={slot.label}
          className="w-full sm:w-72"
        >
          <SelectValue placeholder={`Select a ${slot.label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!!value && !choices.some(choice => choice.value === value) && <p role="alert" className="text-sm text-destructive">The saved item is unavailable. Choose an available replacement.</p>}
    </div>
  );
}
