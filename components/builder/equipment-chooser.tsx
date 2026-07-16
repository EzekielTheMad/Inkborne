"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
  type EquipmentOption,
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
        <div className="grid gap-2" role="group" aria-label={group.label}>
          {group.options.map((option) => (
            <OptionButton
              key={option.id}
              option={option}
              selected={activeOption?.id === option.id}
              disabled={disabled}
              onClick={() => onSelectOption(group.key, option.id)}
            />
          ))}
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

function OptionButton({
  option,
  selected,
  disabled,
  onClick,
}: {
  option: EquipmentOption;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-md border bg-card/30 px-3 py-2.5 text-left transition-colors",
        "border-border",
        !disabled && "cursor-pointer hover:border-accent/50",
        selected && "border-accent bg-accent/10",
        disabled && !selected && "opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-accent" : "border-muted-foreground",
        )}
      >
        {selected && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span className="text-sm">
        <span className="mr-1.5 font-semibold text-muted-foreground">
          ({option.id})
        </span>
        {option.label}
      </span>
    </button>
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
          if (typeof next === "string") onPick(slot.key, next);
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
    </div>
  );
}
