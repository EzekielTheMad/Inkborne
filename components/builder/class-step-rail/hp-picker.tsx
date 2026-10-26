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

function hpGain(contribution: number, conMod: number): number {
  return Math.max(1, contribution + conMod);
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
    const display = hpGain(avg, conMod);
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
    const display = hpGain(hitDie, conMod);
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
  const [manualError, setManualError] = useState(false);
  const manualHintId = `${labelId}-manual-hint`;
  const [showManualInput, setShowManualInput] = useState(storedRoll?.method === "manual");
  const [manualValue, setManualValue] = useState<string>(
    storedRoll?.method === "manual" ? String(storedRoll.value) : "",
  );

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
    if (onlyRoll) return;
    const n = Number(manualValue);
    if (!manualValue.trim() || !Number.isInteger(n) || n < 1 || n > hitDie) {
      setManualError(true);
      return;
    }
    setManualError(false);
    if (storedRoll?.method === "manual" && storedRoll.value === n) return;
    onChange({ method: "manual", value: n });
  }

  const displayValue = storedRoll ? hpGain(storedRoll.value, conMod) : null;
  const methodId = `${labelId}-method`;
  const method = showManualInput && !onlyRoll ? "manual" : onlyRoll && storedRoll?.method !== "rolled" ? "" : storedRoll?.method ?? "";

  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <p id={labelId} className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
        Hit points
      </p>
      <label className="mt-3 block text-sm" htmlFor={methodId}>Hit point method</label>
      <select id={methodId} value={method} onChange={event => {
        if (event.target.value === "average" && !onlyRoll) handleAverage();
        if (event.target.value === "rolled") handleRoll();
        if (event.target.value === "manual" && !onlyRoll) handleManualToggle();
      }} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">Choose a hit point method</option>
        {!onlyRoll && <option value="average">Average (+{hpGain(avg, conMod)})</option>}
        <option value="rolled">Roll d{hitDie}{storedRoll?.method === "rolled" ? ` (+${hpGain(storedRoll.value, conMod)})` : ""}</option>
        {!onlyRoll && <option value="manual">Manual{storedRoll?.method === "manual" ? ` (+${hpGain(storedRoll.value, conMod)})` : ""}</option>}
      </select>
      {onlyRoll && storedRoll && storedRoll.method !== "rolled" && <p role="alert" className="mt-2 text-sm text-destructive">
        The saved {storedRoll.method} HP choice is unavailable under this campaign rule. It remains saved until you choose a roll.
      </p>}
      {showManualInput && !onlyRoll && (
        <div className="mt-3">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={hitDie}
            aria-label="Manual HP value"
            aria-describedby={manualHintId}
            aria-invalid={manualError || undefined}
            value={manualValue}
            onChange={(e) => { setManualValue(e.target.value); setManualError(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitManual();
            }}
            onBlur={(event) => {
              const next = event.relatedTarget;
              // Selecting a different method supersedes this unsaved manual draft.
              // Its blur must not dispatch a competing manual save first.
              if (next instanceof Element && next.id === methodId) return;
              commitManual();
            }}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <span id={manualHintId} role={manualError ? "alert" : undefined} className={cn("ml-2 text-xs", manualError ? "text-destructive" : "text-muted-foreground")}>
            {manualError ? `Enter a whole number from 1 to ${hitDie}.` : `Enter a value in [1, ${hitDie}]`}
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
