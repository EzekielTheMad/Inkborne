"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { SaveBuilderStep } from "@/lib/builder/builder-step-command";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";
import { isOrdinaryClassSpellEligible } from "@/lib/spells/spell-eligibility";
import { computeMaxPrepared } from "@/lib/spells/helpers";
import { useSaveNavigationGuard } from "@/lib/builder/use-save-navigation-guard";

export interface BuilderSpellSelection {
  content_id: string;
  content_version: number;
  is_prepared: boolean;
  always_prepared?: boolean;
  /** Saved ordinary preparation intent before Signature Spells projection. */
  prepared_intent?: boolean;
}

export interface ClassSpellsPanelProps {
  source: EffectiveCastingSource;
  catalog: ContentEntry[];
  /** Only ordinary spell selections belonging to this casting source. */
  selected: BuilderSpellSelection[];
  /** Confirmed scores including racial and ASI contributions. */
  abilityScores: Record<string, number>;
  saveAction: SaveBuilderStep;
  disabled?: boolean;
  onSaved?: () => void;
  onDirtyChange?: (classSlug: string, dirty: boolean) => void;
}

const PAGE_SIZE = 20;
const title = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const selectionKey = (value: BuilderSpellSelection[]) => JSON.stringify([...value].sort((a, b) => a.content_id.localeCompare(b.content_id)));

function spellLevel(entry: ContentEntry | undefined): number | null {
  const level = entry?.data.level;
  return typeof level === "number" && Number.isInteger(level) && level >= 0 && level <= 9 ? level : null;
}

interface SpellSectionProps {
  label: string;
  entries: ContentEntry[];
  selections: BuilderSpellSelection[];
  showPrepared: boolean;
  expandedSpellSlugs: readonly string[];
  disabled: boolean;
  onToggle: (entry: ContentEntry) => void;
  onPrepare: (entry: ContentEntry, prepared: boolean) => void;
}

function SpellSection({ label, entries, selections, showPrepared, expandedSpellSlugs, disabled, onToggle, onPrepare }: SpellSectionProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => entries.filter(entry => entry.name.toLowerCase().includes(query.trim().toLowerCase())), [entries, query]);
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  return <section aria-label={label} className="space-y-3">
    <h4 className="text-sm font-semibold">{label}</h4>
    <Input aria-label={`Search ${label.toLowerCase()}`} placeholder="Search spells" value={query} disabled={disabled}
      onChange={event => { setQuery(event.target.value); setPage(0); }} />
    {!visible.length ? <p className="text-sm text-muted-foreground">No matching spells.</p> :
      <div className="space-y-2">{visible.map(entry => {
        const selected = selections.find(item => item.content_id === entry.id && item.content_version === entry.version);
        return <div key={`${entry.id}:${entry.version}`} className="rounded-md border border-border bg-card/40 p-3">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" aria-label={`Select ${entry.name}`} checked={!!selected} disabled={disabled}
              onChange={() => onToggle(entry)} />
            <span className="font-medium">{entry.name}</span>
            {expandedSpellSlugs.includes(entry.slug) && <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Expanded list</span>}
            <span className="ml-auto text-xs text-muted-foreground">{spellLevel(entry) === 0 ? "Cantrip" : `Level ${spellLevel(entry)}`}</span>
          </label>
          {selected?.always_prepared && <p className="mt-2 pl-6 text-sm text-muted-foreground">Always prepared by Signature Spells.</p>}
          {selected && !selected.always_prepared && showPrepared && <label className="mt-2 flex items-center gap-2 pl-6 text-sm text-muted-foreground">
            <input type="checkbox" aria-label={`Prepare ${entry.name}`} checked={selected.is_prepared} disabled={disabled}
              onChange={event => onPrepare(entry, event.target.checked)} />Prepared
          </label>}
        </div>;
      })}</div>}
    {filtered.length > PAGE_SIZE && <div className="flex items-center justify-between gap-2 text-sm">
      <Button type="button" variant="outline" size="sm" disabled={disabled || currentPage === 0} onClick={() => setPage(currentPage - 1)}
        aria-label={`Previous ${label.toLowerCase()} page`}>Previous</Button>
      <span>Page {currentPage + 1} of {lastPage + 1}</span>
      <Button type="button" variant="outline" size="sm" disabled={disabled || currentPage === lastPage} onClick={() => setPage(currentPage + 1)}
        aria-label={`Next ${label.toLowerCase()} page`}>Next</Button>
    </div>}
  </section>;
}

export function ClassSpellsPanel({ source, catalog, selected, abilityScores, saveAction, disabled = false, onSaved, onDirtyChange }: ClassSpellsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const incomingKey = selectionKey(selected);
  const sourceKey = JSON.stringify([source, abilityScores]);
  const [draft, setDraft] = useState(() => ({ sourceKey, baselineKey: incomingKey, value: selected, dirty: false }));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { notice, setBlocked } = useSaveNavigationGuard("spell choices");
  useEffect(() => {
    const unsaved = draft.dirty || pending;
    setBlocked(unsaved); onDirtyChange?.(source.classSlug, unsaved);
    return () => onDirtyChange?.(source.classSlug, false);
  }, [draft.dirty, pending, source.classSlug, setBlocked, onDirtyChange]);
  // A refresh can replace an untouched draft. An edited draft is retained so a
  // new server snapshot cannot silently discard or rebase the user's choices.
  if (!draft.dirty && (draft.sourceKey !== sourceKey || draft.baselineKey !== incomingKey)) {
    setDraft({ sourceKey, baselineKey: incomingKey, value: selected, dirty: false });
    if (draft.sourceKey !== sourceKey) setSaved(false);
  }
  const changedWhileEditing = draft.dirty && (draft.sourceKey !== sourceKey || draft.baselineKey !== incomingKey);
  const maxLevel = Math.min(source.maxLearnableLevel, source.spellList.level[1]);
  const sourceReady = source.active && source.config !== null && Number.isInteger(source.classLevel) && source.classLevel >= 1
    && source.classLevel <= 20 && Number.isInteger(source.cantripsKnown) && source.cantripsKnown >= 0
    && Number.isInteger(source.spellList.level[0]) && source.spellList.level[0] >= 0
    && Number.isInteger(maxLevel) && maxLevel >= source.spellList.level[0] && maxLevel <= 9;
  const entries = useMemo(() => catalog.filter((entry, index) => {
    const level = spellLevel(entry);
    const pin = selected.find(item => item.content_id === entry.id);
    if (pin ? entry.version !== pin.content_version : catalog.findIndex(item => item.id === entry.id) !== index) return false;
    return entry.content_type === "spell" && level !== null && isOrdinaryClassSpellEligible(source, entry);
  }).sort((a, b) => (spellLevel(a)! - spellLevel(b)!) || a.name.localeCompare(b.name)), [catalog, source, selected]);
  const byId = useMemo(() => {
    const result = new Map<string, ContentEntry[]>();
    for (const entry of entries) result.set(entry.id, [...(result.get(entry.id) ?? []), entry]);
    return result;
  }, [entries]);
  const unavailable = draft.value.filter(item => {
    const matches = byId.get(item.content_id) ?? [];
    return matches.length !== 1 || matches[0].version !== item.content_version;
  });
  const duplicateSelections = new Set(draft.value.map(item => item.content_id)).size !== draft.value.length;
  const cantripCount = draft.value.filter(item => spellLevel(byId.get(item.content_id)?.[0]) === 0).length;
  const leveledCount = draft.value.length - cantripCount;
  const preparedCount = draft.value.filter(item => item.is_prepared && !item.always_prepared && spellLevel(byId.get(item.content_id)?.[0]) !== 0).length;
  const wizardBook = source.kind === "class" && source.classSlug === "wizard";
  const bookSize = 6 + 2 * (source.classLevel - 1);
  const ability = source.config ? abilityScores[source.config.ability] : undefined;
  const modifier = typeof ability === "number" && Number.isFinite(ability) ? Math.floor((ability - 10) / 2) : null;
  const preparedLimit = !source.prepared ? 0 : modifier === null ? null : source.preparationRule === "parent"
    ? computeMaxPrepared(source.classSlug, source.classLevel, modifier)
    : Math.max(1, modifier + (source.preparationRule === "half-class-level-plus-ability" ? Math.floor(source.classLevel / 2) : source.classLevel));
  const knownCountReady = source.spellsKnown === "all" || (Number.isInteger(source.spellsKnown) && source.spellsKnown >= 0);
  const valid = sourceReady && knownCountReady && !changedWhileEditing && !unavailable.length && !duplicateSelections && draft.value.length <= 200
    && cantripCount <= source.cantripsKnown && (!wizardBook || leveledCount <= bookSize)
    && (source.prepared ? preparedLimit !== null && preparedCount <= preparedLimit
      : source.spellsKnown === "all" || leveledCount <= source.spellsKnown);
  const locked = disabled || pending || !sourceReady || changedWhileEditing || unavailable.length > 0 || duplicateSelections;
  const update = (value: BuilderSpellSelection[]) => {
    setDraft(previous => ({ ...previous, value, dirty: true })); setError(null); setSaved(false);
  };
  function toggle(entry: ContentEntry) {
    const existing = draft.value.find(item => item.content_id === entry.id);
    update(existing ? draft.value.filter(item => item.content_id !== entry.id) : [...draft.value, {
      content_id: entry.id, content_version: entry.version, is_prepared: source.prepared && spellLevel(entry)! > 0,
    }]);
  }
  function prepare(entry: ContentEntry, is_prepared: boolean) {
    update(draft.value.map(item => item.content_id === entry.id ? { ...item, is_prepared } : item));
  }
  const className = title(source.classSlug);
  return <form aria-label={`${className} spell choices`} className="space-y-4 rounded-md border border-border p-4" onSubmit={event => {
    event.preventDefault();
    if (!valid || locked || inFlight.current) return;
    inFlight.current = true;
    const submitted = draft.value.map(item => ({ content_id: item.content_id, content_version: item.content_version,
      prepared: spellLevel(byId.get(item.content_id)?.[0]) === 0 ? false
        : item.always_prepared ? item.prepared_intent ?? false : item.is_prepared }));
    setError(null); setSaved(false);
    startTransition(async () => {
      try {
        await saveAction("select_class_spells", { class_slug: source.classSlug, spells: submitted });
        setDraft(previous => ({ ...previous, dirty: false })); setSaved(true);
        onSaved?.(); router.refresh();
      } catch {
        setError("These spell choices could not be confirmed. Your selections are kept here. Reload the saved choices before trying again.");
      } finally { inFlight.current = false; }
    });
  }}>
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{className} Spells</h3>
      <p className="text-sm text-muted-foreground">Choose {source.cantripsKnown} cantrips from your class list. Spell choices save together when you select Save spells.</p>
      {!!source.expandedSpellSlugs?.length && <p className="text-sm text-muted-foreground">Your patron&apos;s expanded spells are available below. They count toward your spells-known allowance.</p>}
      <p className="text-sm">Cantrips: {cantripCount} / {source.cantripsKnown}</p>
      {wizardBook ? <p className="text-sm">Spellbook: {leveledCount} / {bookSize} spells</p>
        : !source.prepared && source.spellsKnown !== "all" ? <p className="text-sm">Spells known: {leveledCount} / {source.spellsKnown}</p> : null}
      {source.prepared && <p className="text-sm">Prepared spells: {preparedCount} / {preparedLimit ?? "unavailable"}. Always-prepared feature spells do not use this allowance.</p>}
      <p className="text-xs text-muted-foreground">You can save an unfinished selection and return to it. Keep each selection within its allowance.</p>
    </div>
    {!sourceReady && <p role="alert" className="text-sm text-destructive">This class&apos;s saved spellcasting progression is unavailable. Reload its saved content before choosing spells.</p>}
    {source.prepared && preparedLimit === null && <p role="alert" className="text-sm text-destructive">Confirm your ability scores before preparing spells.</p>}
    {changedWhileEditing && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">The saved class or spell choices changed while you were editing. Your draft is kept until you choose to use the saved choices.</p>
      <Button type="button" variant="outline" disabled={pending || disabled} onClick={() => {
        setDraft({ sourceKey, baselineKey: incomingKey, value: selected, dirty: false }); setError(null); setSaved(false);
      }}>Use saved spells</Button></div>}
    {!!unavailable.length && <p role="alert" className="text-sm text-destructive">{unavailable.length} saved spell version(s) are unavailable in this catalog. They have been kept. Restore the saved versions before editing; current versions will not replace them automatically.</p>}
    {duplicateSelections && <p role="alert" className="text-sm text-destructive">The saved spell selections contain duplicates. Reload the character before editing.</p>}
    <fieldset disabled={locked} className="space-y-5 border-0 p-0">
      <SpellSection label={`${className} cantrips`} entries={entries.filter(entry => spellLevel(entry) === 0)} selections={draft.value}
        showPrepared={false} expandedSpellSlugs={source.expandedSpellSlugs ?? []} disabled={locked} onToggle={toggle} onPrepare={prepare} />
      {maxLevel > 0 && <SpellSection label={`${className} levelled spells`} entries={entries.filter(entry => spellLevel(entry)! > 0)} selections={draft.value}
        showPrepared={source.prepared} expandedSpellSlugs={source.expandedSpellSlugs ?? []} disabled={locked} onToggle={toggle} onPrepare={prepare} />}
    </fieldset>
    <Button type="submit" disabled={locked || !valid}>{pending ? "Saving spells…" : "Save spells"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {saved && !pending && <p role="status" className="text-sm">Spell choices saved.</p>}
  </form>;
}
