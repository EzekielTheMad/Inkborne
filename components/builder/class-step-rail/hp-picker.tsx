"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HpRollRecord } from "@/lib/types/character";
import type { HpRule } from "@/lib/builder/level-up-rules";

interface HpPickerProps {
  classSlug: string;
  level: number;
  hitDie: number;
  conMod: number;
  isFirstLevelOfPrimary: boolean;
  hpRule: HpRule;
  storedRoll: HpRollRecord | undefined;
  onChange: (record: HpRollRecord) => void;
}

function averageHitDie(die: number): number {
  return Math.floor(die / 2) + 1;
}

function rollDie(die: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % die) + 1;
}

export function HpPicker(props: HpPickerProps) {
  const { classSlug, level, hitDie, conMod, isFirstLevelOfPrimary, hpRule, storedRoll, onChange } = props;

  if (isFirstLevelOfPrimary) return null;

  const avg = averageHitDie(hitDie);
  const isLevelOneOfClass = level === 1;
  const labelId = `hp-method-label-${classSlug}-${level}`;

  const isMaxLocked =
    hpRule === "max_for_all" ||
    (hpRule === "max_first_level_each_class" && isLevelOneOfClass);
  const isAverageLocked = hpRule === "average_only";
  const isRolledOnly = hpRule === "rolled_only";

  if (isAverageLocked) {
    const display = avg + conMod;
    return (
      <div className="rounded-md border border-border bg-card/40 p-4">
        <p id={labelId} className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
          Hit points
        </p>
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Campaign rule: Average</span>
          <span className="ml-2 font-semibold text-foreground">+{display}</span>
        </p>
      </div>
    );
  }

  if (isMaxLocked) {
    const display = hitDie + conMod;
    const ruleLabel =
      hpRule === "max_for_all"
        ? "Campaign rule: Max"
        : "First level of class — Max";
    return (
      <div className="rounded-md border border-border bg-card/40 p-4">
        <p id={labelId} className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
          Hit points
        </p>
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">{ruleLabel}</span>
          <span className="ml-2 font-semibold text-foreground">+{display}</span>
        </p>
      </div>
    );
  }

  return (
    <HpPickerInteractive
      labelId={labelId}
      hitDie={hitDie}
      avg={avg}
      conMod={conMod}
      storedRoll={storedRoll}
      onChange={onChange}
      onlyRoll={isRolledOnly}
    />
  );
}

interface InteractiveProps {
  labelId: string;
  hitDie: number;
  avg: number;
  conMod: number;
  storedRoll: HpRollRecord | undefined;
  onChange: (record: HpRollRecord) => void;
  onlyRoll: boolean;
}

function HpPickerInteractive(props: InteractiveProps) {
  const { labelId, hitDie, avg, conMod, storedRoll, onChange, onlyRoll } = props;
  const [showManualInput, setShowManualInput] = useState(storedRoll?.method === "manual");
  const [manualValue, setManualValue] = useState<string>(
    storedRoll?.method === "manual" ? String(storedRoll.value) : "",
  );

  function isChecked(method: HpRollRecord["method"]): boolean {
    return storedRoll?.method === method;
  }

  function handleAverage() {
    setShowManualInput(false);
    onChange({ method: "average", value: avg });
  }

  function handleRoll() {
    setShowManualInput(false);
    onChange({ method: "rolled", value: rollDie(hitDie) });
  }

  function handleManualToggle() {
    setShowManualInput(true);
  }

  function commitManual() {
    const n = Number.parseInt(manualValue, 10);
    if (!Number.isInteger(n) || n < 1 || n > hitDie) return;
    onChange({ method: "manual", value: n });
  }

  const displayValue = storedRoll ? storedRoll.value + conMod : null;

  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <p id={labelId} className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
        Hit points
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="mt-3 flex flex-wrap items-center gap-2">
        {!onlyRoll && (
          <button
            type="button"
            role="radio"
            aria-checked={isChecked("average") ? "true" : "false"}
            onClick={handleAverage}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              isChecked("average") ? "border-accent bg-accent/10 text-accent-foreground" : "border-border hover:bg-accent/5",
            )}
          >
            Average (+{avg + conMod})
          </button>
        )}
        <button
          type="button"
          role="radio"
          aria-checked={isChecked("rolled") ? "true" : "false"}
          onClick={handleRoll}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors",
            isChecked("rolled") ? "border-accent bg-accent/10 text-accent-foreground" : "border-border hover:bg-accent/5",
          )}
        >
          Roll d{hitDie}
          {isChecked("rolled") && storedRoll && (
            <span className="ml-1 text-muted-foreground">(+{storedRoll.value + conMod})</span>
          )}
        </button>
        {!onlyRoll && (
          <button
            type="button"
            role="radio"
            aria-checked={isChecked("manual") ? "true" : "false"}
            onClick={handleManualToggle}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              isChecked("manual") ? "border-accent bg-accent/10 text-accent-foreground" : "border-border hover:bg-accent/5",
            )}
          >
            Manual
            {isChecked("manual") && storedRoll && (
              <span className="ml-1 text-muted-foreground">(+{storedRoll.value + conMod})</span>
            )}
          </button>
        )}
      </div>
      {showManualInput && (
        <div className="mt-3">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={hitDie}
            aria-label="Manual HP value"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitManual();
            }}
            onBlur={commitManual}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <span className="ml-2 text-xs text-muted-foreground">
            Enter a value in [1, {hitDie}]
          </span>
        </div>
      )}
      {displayValue !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Total HP gain this level: <span className="font-semibold text-foreground">+{displayValue}</span>
        </p>
      )}
    </div>
  );
}
