"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isFavoredEnemyComplete, type FavoredEnemyChoice, type FavoredEnemyOptions } from "@/lib/builder/favored-enemy";

const title = (value: string) => value.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");

export function ChoiceCardFavoredEnemy({ featureSlug, label, options, value, availableLanguages, onSelect }: {
  featureSlug: string; label: string; options: FavoredEnemyOptions; value?: FavoredEnemyChoice;
  availableLanguages: readonly string[]; onSelect: (choice: FavoredEnemyChoice) => Promise<void> | void;
}) {
  const [kind, setKind] = useState(value?.selection.mode === "humanoids" ? "humanoids" : value?.selection.enemy_type ?? "");
  const [races, setRaces] = useState(value?.selection.mode === "humanoids" ? value.selection.races : ["", ""]);
  const [language, setLanguage] = useState(value?.language ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const candidate: FavoredEnemyChoice = { selection: kind === "humanoids" ? { mode: "humanoids", races } :
    { mode: "type", enemy_type: kind }, language: language || null };
  const complete = isFavoredEnemyComplete({ data: { feature_type: "favored_enemy", favored_enemy: options } }, candidate, availableLanguages);
  return <article className="space-y-3 rounded-md border border-border bg-card/40 p-4" aria-labelledby={`${featureSlug}-title`}>
    <h4 id={`${featureSlug}-title`} className="text-sm font-medium">{label}</h4>
    <label className="block text-sm">Favored enemy
      <select className="mt-1 block w-full rounded border bg-background p-2" value={kind} disabled={saving}
        onChange={event => setKind(event.target.value)}>
        <option value="">Choose an enemy</option>
        {options.enemy_types.map(type => <option key={type} value={type}>{title(type)}</option>)}
        <option value="humanoids">Two humanoid races</option>
      </select>
    </label>
    {kind === "humanoids" && <fieldset className="space-y-2"><legend className="text-sm">Supported humanoid races</legend>
      {[0, 1].map(index => <label key={index} className="block text-sm">Humanoid race {index + 1}
        <select className="mt-1 block w-full rounded border bg-background p-2" value={races[index] ?? ""} disabled={saving}
          onChange={event => setRaces(current => current.map((race, at) => at === index ? event.target.value : race))}>
          <option value="">Choose a race</option>
          {options.humanoid_races.map(race => <option key={race} value={race} disabled={races[1 - index] === race}>{title(race)}</option>)}
        </select>
      </label>)}
    </fieldset>}
    <label className="block text-sm">Language spoken by your favored enemies
      <select className="mt-1 block w-full rounded border bg-background p-2" value={language} disabled={saving}
        onChange={event => setLanguage(event.target.value)}>
        <option value="">No spoken language</option>
        {availableLanguages.map(item => <option key={item} value={item}>{title(item)}</option>)}
      </select>
    </label>
    <p className="text-xs text-muted-foreground">Choose a language these enemies speak in your campaign. Tracking and recall benefits apply when the feature describes them.</p>
    <Button disabled={!complete || saving} onClick={async () => {
      setSaving(true); setError("");
      try { await onSelect(candidate); } catch { setError("This choice could not be saved. Reload and try again."); }
      finally { setSaving(false); }
    }}>{saving ? "Saving…" : "Save favored enemy"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </article>;
}
