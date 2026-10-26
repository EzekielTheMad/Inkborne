"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isFavoredEnemyComplete, type FavoredEnemyChoice, type FavoredEnemyOptions } from "@/lib/builder/favored-enemy";

const title = (value: string) => value.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

export function ChoiceCardFavoredEnemy({ featureSlug, label, options, value, availableLanguages, otherChoices = [], onSelect }: {
  featureSlug: string; label: string; options: FavoredEnemyOptions; value?: FavoredEnemyChoice;
  otherChoices?: readonly FavoredEnemyChoice[];
  availableLanguages: readonly string[]; onSelect: (choice: FavoredEnemyChoice) => Promise<void> | void;
}) {
  const [kind, setKind] = useState(value?.selection.mode === "humanoids" ? "humanoids" : value?.selection.enemy_type ?? "");
  const [races, setRaces] = useState(value?.selection.mode === "humanoids" ? value.selection.races : ["", ""]);
  const [language, setLanguage] = useState(value?.language ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const candidate: FavoredEnemyChoice = { selection: kind === "humanoids" ? { mode: "humanoids", races } :
    { mode: "type", enemy_type: kind }, language: language || null };
  const complete = isFavoredEnemyComplete({ data: { feature_type: "favored_enemy", favored_enemy: options } }, candidate, availableLanguages, otherChoices);
  const enemyTypes = options.enemy_types.filter(type => !otherChoices.some(other => other.selection.mode === "type" && other.selection.enemy_type === type));
  const humanoidRaces = options.humanoid_races.filter(race => !otherChoices.some(other => other.selection.mode === "humanoids" && other.selection.races.includes(race)));
  const supportedKind = kind === "humanoids" ? humanoidRaces.length >= 2 : enemyTypes.includes(kind);
  const savedUnavailable = value && !isFavoredEnemyComplete({ data: { feature_type: "favored_enemy", favored_enemy: options } }, value, availableLanguages, otherChoices);
  const unavailableRaces = kind === "humanoids" && races.some((race, index) => race && (!humanoidRaces.includes(race) || races[1 - index] === race));
  const unavailableLanguage = language && !availableLanguages.includes(language);
  return <article className="space-y-3 rounded-md border border-border bg-card/40 p-4" aria-labelledby={`${featureSlug}-title`}>
    <h4 id={`${featureSlug}-title`} className="text-sm font-medium">{label}</h4>
    {value && <p className="text-sm text-muted-foreground">
      Saved favored enemy: {value.selection.mode === "type" ? title(value.selection.enemy_type) || "enemy not selected" : value.selection.races.map(title).join(", ")}
      {value.language ? ` · ${title(value.language)}` : " · No spoken language"}
    </p>}
    <label className="block text-sm">Favored enemy
      <select className="mt-1 block w-full rounded border bg-background p-2" value={supportedKind ? kind : ""} disabled={saving}
        onChange={event => setKind(event.target.value)}>
        <option value="">Choose an enemy</option>
        {enemyTypes.map(type => <option key={type} value={type}>{title(type)}</option>)}
        {humanoidRaces.length >= 2 && <option value="humanoids">Two humanoid races</option>}
      </select>
    </label>
    {kind === "humanoids" && <fieldset className="space-y-2"><legend className="text-sm">Supported humanoid races</legend>
      {[0, 1].map(index => <label key={index} className="block text-sm">Humanoid race {index + 1}
        <select className="mt-1 block w-full rounded border bg-background p-2" value={humanoidRaces.includes(races[index]) && races[1 - index] !== races[index] ? races[index] : ""} disabled={saving}
          onChange={event => setRaces(current => current.map((race, at) => at === index ? event.target.value : race))}>
          <option value="">Choose a race</option>
          {humanoidRaces.filter(race => races[1 - index] !== race).map(race => <option key={race} value={race}>{title(race)}</option>)}
        </select>
      </label>)}
    </fieldset>}
    <label className="block text-sm">Language spoken by your favored enemies
      <select className="mt-1 block w-full rounded border bg-background p-2" value={!language || availableLanguages.includes(language) ? language : ""} disabled={saving}
        onChange={event => setLanguage(event.target.value)}>
        <option value="">No spoken language</option>
        {availableLanguages.map(item => <option key={item} value={item}>{title(item)}</option>)}
      </select>
    </label>
    {(savedUnavailable || kind && !supportedKind || unavailableRaces || unavailableLanguage) && <p role="alert" className="text-sm text-destructive">
      A saved or draft favored enemy choice is unavailable: {title(kind) || "enemy not selected"}
      {kind === "humanoids" ? ` (${races.filter(Boolean).map(title).join(", ")})` : ""}{language ? `, ${title(language)}` : ""}.
      Saved values remain unchanged until you save a valid replacement.
    </p>}
    <p className="text-xs text-muted-foreground">Choose a language these enemies speak in your campaign. Tracking and recall benefits apply when the feature describes them.</p>
    <Button disabled={!complete || saving} onClick={async () => {
      if (!complete || saving) return;
      setSaving(true); setError("");
      try { await onSelect(candidate); } catch { setError("This choice could not be saved. Reload and try again."); }
      finally { setSaving(false); }
    }}>{saving ? "Saving…" : "Save favored enemy"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </article>;
}
