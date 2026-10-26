"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { isAsiChoiceComplete } from "@/lib/builder/choice-validation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AsiAllocation, AsiChoice, UsableFeatOption, UsableFeatSearch } from "@/lib/types/character";

interface ChoiceCardASIProps {
  featureSlug: string;
  currentChoice: AsiChoice | undefined;
  /** Exact resolved scores with this feature's current ASI/feat contribution excluded. */
  abilityScores?: Readonly<Record<string, number>>;
  feats: UsableFeatOption[];
  onSearch?: UsableFeatSearch;
  onSelect: (choice: AsiChoice) => Promise<void> | void;
}

const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const ABBR: Record<string, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA",
};
const selectClass = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
type AbilityMode = "single" | "split";

function provenance(feat: UsableFeatOption): string {
  if (feat.source === "platform") return "Official";
  if (feat.source === "imported") return "Imported";
  return feat.scope === "shared" ? "Campaign homebrew" : "Your homebrew";
}

export function ChoiceCardASI({ featureSlug, currentChoice, abilityScores, feats, onSearch, onSelect }: ChoiceCardASIProps) {
  const [choiceMode, setChoiceMode] = useState<"ability" | "feat">(currentChoice?.mode === "feat" ? "feat" : "ability");
  const [abilityMode, setAbilityMode] = useState<AbilityMode>(
    currentChoice?.mode === "asi" && currentChoice.allocations.length === 2 ? "split" : "single",
  );
  const [splitPicks, setSplitPicks] = useState<string[]>(() => currentChoice?.mode === "asi"
    ? currentChoice.allocations.filter(item => item.amount === 1).map(item => item.ability) : []);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(feats);
  const [searching, setSearching] = useState(currentChoice?.mode === "feat" && Boolean(onSearch));
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequest = useRef(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestId = ++searchRequest.current;
    if (!onSearch || choiceMode !== "feat") return;
    const timer = window.setTimeout(() => {
      void onSearch(featureSlug, query.trim()).then(
        results => {
          if (searchRequest.current !== requestId) return;
          setSearchResults(results);
          setSearching(false);
        },
        () => {
          if (searchRequest.current !== requestId) return;
          setSearchError("Available feats could not be loaded. Try searching again.");
          setSearching(false);
        },
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [choiceMode, featureSlug, feats, onSearch, query]);

  const filteredFeats = useMemo(() => {
    if (onSearch) return searchResults;
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? feats.filter(feat => `${feat.name} ${feat.description}`.toLocaleLowerCase().includes(normalized))
      : feats;
  }, [feats, onSearch, query, searchResults]);
  const eligibleFeats = filteredFeats.filter(feat => feat.prerequisiteMet);
  const scoresAvailable = !!abilityScores && ABILITIES.every(ability =>
    Number.isInteger(abilityScores[ability]) && abilityScores[ability] >= 1 && abilityScores[ability] <= 30);
  const singleAbilities = scoresAvailable ? ABILITIES.filter(ability => abilityScores![ability] <= 18) : [];
  const splitAbilities = scoresAvailable ? ABILITIES.filter(ability => abilityScores![ability] <= 19) : [];
  const modes: AbilityMode[] = [
    ...(singleAbilities.length ? ["single" as const] : []),
    ...(splitAbilities.length >= 2 ? ["split" as const] : []),
  ];
  const featAvailable = !!onSearch || feats.some(feat => feat.prerequisiteMet);
  const featKey = currentChoice?.mode === "feat" ? `${currentChoice.featId}:${currentChoice.featVersion}` : "";
  const selectedFeat = [...filteredFeats, ...feats].find(feat => `${feat.id}:${feat.version}` === featKey);
  const offeredSelectedFeat = eligibleFeats.some(feat => `${feat.id}:${feat.version}` === featKey);
  const savedAsiAvailable = currentChoice?.mode !== "asi" || scoresAvailable && isAsiChoiceComplete(currentChoice)
    && new Set(currentChoice.allocations.map(item => item.ability)).size === currentChoice.allocations.length
    && currentChoice.allocations.every(item => ABILITIES.some(ability => ability === item.ability)
      && abilityScores![item.ability] + item.amount <= 20);
  const singleAllocation = currentChoice?.mode === "asi" && currentChoice.allocations.length === 1
    ? currentChoice.allocations[0] : undefined;
  const singleAbility = singleAllocation?.amount === 2 && singleAbilities.some(ability => ability === singleAllocation.ability)
    ? singleAllocation.ability : "";
  const isMade = isAsiChoiceComplete(currentChoice);

  async function persist(choice: AsiChoice) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onSelect(choice);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This choice could not be saved. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function chooseSplit(index: number, ability: string) {
    if (pending || !splitAbilities.some(item => item === ability) || splitPicks[1 - index] === ability) return;
    const next = [splitPicks[0] ?? "", splitPicks[1] ?? ""];
    next[index] = ability;
    setSplitPicks(next);
    // A partial split remains local draft state, never a character write.
    if (next.every(item => splitAbilities.some(eligible => eligible === item)) && new Set(next).size === 2) {
      void persist({ mode: "asi", allocations: next.map(item => ({ ability: item, amount: 1 })) as AsiAllocation[] });
    }
  }

  return (
    <article className="rounded-md border border-border bg-card/40 p-4" data-feature-slug={featureSlug}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <span aria-label={isMade ? "Choice made" : "Choice not yet made"}
          className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            isMade ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive")}>
          {pending ? "Saving" : isMade ? "Chosen" : "Choose"}
        </span>
      </header>
      {currentChoice?.mode === "asi" && (
        <p className="mb-3 text-sm text-muted-foreground">
          Saved improvement: {currentChoice.allocations.map(item => `${ABBR[item.ability] ?? item.ability} +${item.amount}`).join(", ")}
        </p>
      )}
      {currentChoice?.mode === "feat" && (
        <div className="mb-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          Saved feat: {currentChoice.featName} <Badge variant="secondary">v{currentChoice.featVersion}</Badge>
        </div>
      )}
      <label className="block text-sm">Improvement type
        <select className={selectClass} disabled={pending}
          value={choiceMode === "ability" ? modes.length ? "ability" : "" : featAvailable ? "feat" : ""}
          onChange={event => {
            if (event.target.value === "ability" && modes.length) {
              setChoiceMode("ability");
              setSearching(false);
            }
            if (event.target.value === "feat" && featAvailable) {
              setChoiceMode("feat");
              if (onSearch) { setSearching(true); setSearchError(null); }
            }
          }}>
          <option value="">Choose an improvement</option>
          {modes.length > 0 && <option value="ability">Ability scores</option>}
          {featAvailable && <option value="feat">Feat</option>}
        </select>
      </label>
      {choiceMode === "ability" ? (
        <div className="mt-3 space-y-3">
          {!scoresAvailable && <p role="alert" className="text-sm text-destructive">
            Ability scores for this improvement are unavailable. Reload before changing them; the saved choice remains unchanged.
          </p>}
          {scoresAvailable && !modes.length && <p role="status" className="text-sm text-muted-foreground">
            No ability increase is available below the score limit of 20.
          </p>}
          {currentChoice?.mode === "asi" && !savedAsiAvailable && scoresAvailable && <p role="alert" className="text-sm text-destructive">
            The saved improvement is unavailable with these ability scores. It remains saved until you choose a valid replacement.
          </p>}
          <label className="block text-sm">Ability increase
            <select className={selectClass} value={modes.includes(abilityMode) ? abilityMode : ""} disabled={pending || !scoresAvailable}
              onChange={event => {
                if (modes.includes(event.target.value as AbilityMode)) setAbilityMode(event.target.value as AbilityMode);
              }}>
              <option value="">Choose an increase</option>
              {modes.includes("single") && <option value="single">One ability by +2</option>}
              {modes.includes("split") && <option value="split">Two abilities by +1</option>}
            </select>
          </label>
          {abilityMode === "single" ? (
            <label className="block text-sm">Ability to increase by 2
              <select className={selectClass} value={singleAbility} disabled={pending || !scoresAvailable}
                onChange={event => {
                  if (singleAbilities.some(ability => ability === event.target.value)) {
                    void persist({ mode: "asi", allocations: [{ ability: event.target.value, amount: 2 }] });
                  }
                }}>
                <option value="">Choose an ability</option>
                {singleAbilities.map(ability => <option key={ability} value={ability}>{ABBR[ability]} +2</option>)}
              </select>
            </label>
          ) : (
            <fieldset className="space-y-3">
              <legend className="sr-only">Two ability increases</legend>
              {[0, 1].map(index => (
                <label key={index} className="block text-sm">Ability {index + 1} to increase by 1
                  <select className={selectClass}
                    value={splitAbilities.some(ability => ability === splitPicks[index]) && splitPicks[1 - index] !== splitPicks[index] ? splitPicks[index] : ""}
                    disabled={pending || !scoresAvailable} onChange={event => chooseSplit(index, event.target.value)}>
                    <option value="">Choose an ability</option>
                    {splitAbilities.filter(ability => splitPicks[1 - index] !== ability).map(ability => (
                      <option key={ability} value={ability}>{ABBR[ability]} +1</option>
                    ))}
                  </select>
                </label>
              ))}
              {splitPicks.filter(Boolean).length === 1 && <p className="text-xs text-muted-foreground" role="status">
                Choose one more ability to save this improvement.
              </p>}
            </fieldset>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="relative block">
            <span className="sr-only">Search feats</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} disabled={pending} onChange={event => {
              setQuery(event.target.value);
              if (onSearch) { setSearching(true); setSearchError(null); }
            }} placeholder="Search available feats" className="pl-9" />
          </label>
          {searching && <p className="text-xs text-muted-foreground" role="status">Searching available feats…</p>}
          {searchError && <p className="text-sm text-destructive" role="alert">{searchError}</p>}
          <label className="block text-sm">Available feat
            <select className={selectClass} value={offeredSelectedFeat ? featKey : ""} disabled={pending || searching}
              onChange={event => {
                const feat = eligibleFeats.find(item => `${item.id}:${item.version}` === event.target.value);
                if (feat && !pending && !searching) {
                  void persist({ mode: "feat", featId: feat.id, featVersion: feat.version, featName: feat.name });
                }
              }}>
              <option value="">Choose an available feat</option>
              {eligibleFeats.map(feat => (
                <option key={`${feat.id}:${feat.version}`} value={`${feat.id}:${feat.version}`}>
                  {feat.name} · v{feat.version} · {provenance(feat)}
                </option>
              ))}
            </select>
          </label>
          {!searching && !eligibleFeats.length && <p className="text-sm text-muted-foreground">No available feats match this search.</p>}
          {!searching && currentChoice?.mode === "feat" && !offeredSelectedFeat && <p role="alert" className="text-sm text-destructive">
            Saved feat “{currentChoice.featName}” v{currentChoice.featVersion} is not in the current available results. It remains saved until you choose a replacement.
          </p>}
          {selectedFeat && (
            <div className="rounded-md border border-border bg-card/30 p-3 text-sm">
              <p className="font-medium">
                {selectedFeat.name} <Badge variant="outline">v{selectedFeat.version}</Badge> <Badge variant="secondary">{provenance(selectedFeat)}</Badge>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{selectedFeat.description}</p>
              {selectedFeat.prerequisiteReason && <p className="mt-2 text-xs text-muted-foreground">{selectedFeat.prerequisiteReason}</p>}
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    </article>
  );
}
