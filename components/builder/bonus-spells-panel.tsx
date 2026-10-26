"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { SaveBuilderStep, BuilderStepSaved } from "@/lib/builder/builder-step-command";
import { isBonusSpellEligible, type BonusSpellChoice, type BonusSpellPin } from "@/lib/builder/bonus-spells";
import { useSaveNavigationGuard } from "@/lib/builder/use-save-navigation-guard";

interface BonusSpellsPanelProps {
  feature: ContentEntry;
  choice: BonusSpellChoice;
  catalog: ContentEntry[];
  selected: BonusSpellPin[];
  spellbook: BonusSpellPin[];
  classMaxSpellLevel: number;
  occupied: ReadonlySet<string>;
  saveAction: SaveBuilderStep;
  disabled?: boolean;
  onSaved: (saved: BuilderStepSaved) => void;
  onDirtyChange: (key: string, dirty: boolean) => void;
}

const keyOf = (pins: BonusSpellPin[]) => JSON.stringify([...pins].sort((a, b) => a.content_id.localeCompare(b.content_id)));
const spellKey = (spell: ContentEntry) => `${spell.id}:${spell.version}`;
const selectClassName = "block w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/** Bonus picks retain their feature owner and their own allowance. In particular,
 * a Wizard marks an existing book spell instead of learning a second copy. */
export function BonusSpellsPanel({ feature, choice, catalog, selected, spellbook, classMaxSpellLevel, occupied,
  saveAction, disabled = false, onSaved, onDirtyChange }: BonusSpellsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const incomingKey = keyOf(selected);
  const sourceKey = JSON.stringify([feature.id, feature.version, choice, spellbook, classMaxSpellLevel, [...occupied].sort()]);
  const [draft, setDraft] = useState(() => ({ baselineKey: incomingKey, sourceKey, value: selected, dirty: false }));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { notice, setBlocked } = useSaveNavigationGuard("bonus spell choices");
  const dirtyKey = `bonus:${choice.choice_id}`;
  useEffect(() => {
    const unsaved = draft.dirty || pending;
    setBlocked(unsaved); onDirtyChange(dirtyKey, unsaved);
    return () => onDirtyChange(dirtyKey, false);
  }, [draft.dirty, pending, dirtyKey, setBlocked, onDirtyChange]);
  if (!draft.dirty && (draft.baselineKey !== incomingKey || draft.sourceKey !== sourceKey)) {
    setDraft({ baselineKey: incomingKey, sourceKey, value: selected, dirty: false });
    if (draft.sourceKey !== sourceKey) setSaved(false);
  }
  const changedWhileEditing = draft.dirty && (draft.baselineKey !== incomingKey || draft.sourceKey !== sourceKey);
  const entries = useMemo(() => catalog.filter((spell, index) => {
    const pin = selected.find(item => item.content_id === spell.id);
    if (pin ? spell.version !== pin.content_version : !choice.spellbook_only && catalog.findIndex(item => item.id === spell.id) !== index) return false;
    return spell.content_type === "spell" && isBonusSpellEligible(choice, spell, { classMaxSpellLevel, spellbook });
  })
    .sort((a, b) => Number(a.data.level) - Number(b.data.level) || a.name.localeCompare(b.name)),
  [catalog, choice, classMaxSpellLevel, spellbook, selected]);
  const candidates = entries.filter(spell => !occupied.has(spell.id) || selected.some(pin => pin.content_id === spell.id));
  const unavailable = draft.value.some(pin => candidates.filter(spell => spell.id === pin.content_id && spell.version === pin.content_version).length !== 1);
  const duplicate = new Set(draft.value.map(pin => pin.content_id)).size !== draft.value.length;
  const valid = !unavailable && !duplicate && draft.value.length <= choice.choose && !changedWhileEditing;
  const locked = disabled || pending || changedWhileEditing || unavailable || duplicate;
  const filtered = candidates.filter(spell => spell.name.toLowerCase().includes(query.trim().toLowerCase())
    && candidates.filter(other => other.id === spell.id).length === 1);
  const available = filtered.filter(spell => !draft.value.some(pin => pin.content_id === spell.id));
  const rows: Array<BonusSpellPin | undefined> = [...draft.value];
  if (draft.value.length < choice.choose && available.length > 0) rows.push(undefined);
  const label = `${feature.name}: ${choice.choice_id}`;
  return <form aria-label={label} className="space-y-3 rounded-md border border-border p-4" onSubmit={event => {
    event.preventDefault();
    if (locked || !valid || inFlight.current) return;
    inFlight.current = true; setError(null); setSaved(false);
    startTransition(async () => {
      try {
        const result = await saveAction("select_bonus_spells", { feature_slug: feature.slug, choice_id: choice.choice_id, spells: draft.value });
        setDraft(previous => ({ ...previous, dirty: false })); setSaved(true); onSaved(result); router.refresh();
      } catch {
        setError("These bonus spell choices could not be confirmed. Your draft is kept. Reload the saved choices before trying again.");
      } finally { inFlight.current = false; }
    });
  }}>
    <h3 className="font-semibold">{feature.name}{feature.slug === "spell-mastery" ? ` — level ${choice.min_spell_level}` : ""}</h3>
    <p className="text-sm">Bonus spells: {draft.value.length} / {choice.choose}</p>
    <p className="text-sm text-muted-foreground">{choice.spellbook_only ? "Choose from spells already saved in your spellbook. " : ""}
      {choice.counts_known ? "These picks reserve places in your class spells-known allowance." : "These picks do not use your ordinary class spell allowance."}
      {choice.always_prepared ? " These spells are always prepared." : ""}
      {choice.ritual_only ? " Only first-level ritual spells are eligible." : ""}</p>
    <p className="text-xs text-muted-foreground">Save an unfinished selection and return to it later.</p>
    {changedWhileEditing && <div className="space-y-2"><p role="alert">The saved feature, spellbook or choices changed while you were editing.</p>
      <Button type="button" variant="outline" disabled={pending || disabled} onClick={() => {
        setDraft({ baselineKey: incomingKey, sourceKey, value: selected, dirty: false }); setError(null); setSaved(false);
      }}>Use saved bonus spells</Button></div>}
    {unavailable && <p role="alert">A saved spell version is unavailable or no longer eligible. Reload its saved content before editing.</p>}
    {duplicate && <p role="alert">The saved choices contain duplicate spells. Reload before editing.</p>}
    <fieldset disabled={locked} className="space-y-3 border-0 p-0">
      <Input aria-label={`Search ${feature.name} spells`} placeholder="Search bonus spells" value={query}
        onChange={event => setQuery(event.target.value)} />
      {!filtered.length && <p className="text-sm text-muted-foreground">No eligible spells match. {choice.spellbook_only ? "Save your spellbook choices first." : ""}</p>}
      <div className="space-y-3">{rows.map((pin, index) => {
        const current = pin ? candidates.find(spell => spell.id === pin.content_id && spell.version === pin.content_version) : undefined;
        const options = current ? [current, ...available] : available;
        return <div key={index} className="space-y-1">
          <label className="block space-y-1 text-sm">
            <span>{pin ? `${feature.name} spell ${index + 1}` : `Add ${feature.name} spell`}</span>
            <select className={selectClassName} value={current ? spellKey(current) : ""} disabled={locked}
              onChange={event => {
                if (locked) return;
                const next = options.find(spell => spellKey(spell) === event.target.value);
                if (event.target.value && !next) return;
                if (next && draft.value.some(other => other.content_id === next.id && other.content_id !== pin?.content_id)) return;
                if (!pin && next && draft.value.length >= choice.choose) return;
                const nextPin = next ? { content_id: next.id, content_version: next.version } : undefined;
                setDraft(previous => ({ ...previous, dirty: true, value: pin
                  ? previous.value.flatMap(other => other.content_id !== pin.content_id ? [other] : nextPin ? [nextPin] : [])
                  : nextPin ? [...previous.value, nextPin] : previous.value }));
                setError(null); setSaved(false);
              }}>
              <option value="">{pin ? "Remove this spell" : "Choose a spell"}</option>
              {options.map(spell => <option key={spellKey(spell)} value={spellKey(spell)}>
                {spell.name} — {spell.data.level === 0 ? "Cantrip" : `Level ${spell.data.level}`}
              </option>)}
            </select>
          </label>
          {current && typeof current.data.description === "string" && <p className="text-sm text-muted-foreground">{current.data.description}</p>}
        </div>;
      })}</div>
    </fieldset>
    <Button type="submit" disabled={locked || !valid}>{pending ? "Saving bonus spells…" : `Save ${feature.name} spells`}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {saved && !pending && <p role="status" className="text-sm">Bonus spell choices saved.</p>}
  </form>;
}
