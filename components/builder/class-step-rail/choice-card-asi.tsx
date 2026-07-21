"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  AsiAllocation,
  AsiChoice,
  UsableFeatOption,
  UsableFeatSearch,
} from "@/lib/types/character";

interface ChoiceCardASIProps {
  featureSlug: string;
  currentChoice: AsiChoice | undefined;
  feats: UsableFeatOption[];
  onSearch?: UsableFeatSearch;
  onSelect: (choice: AsiChoice) => Promise<void> | void;
}

const ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

const ABBR: Record<(typeof ABILITIES)[number], string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

type ChoiceMode = "ability" | "feat";
type AbilityMode = "single" | "split";

function initialAbilityMode(choice: AsiChoice | undefined): AbilityMode {
  return choice?.mode === "asi" && choice.allocations.length === 2
    ? "split"
    : "single";
}

function initialSplitPicks(choice: AsiChoice | undefined): string[] {
  if (choice?.mode !== "asi") return [];
  return choice.allocations
    .filter((allocation) => allocation.amount === 1)
    .map((allocation) => allocation.ability);
}

function provenance(feat: UsableFeatOption): string {
  if (feat.source === "platform") return "Official";
  if (feat.source === "imported") return "Imported";
  return feat.scope === "shared" ? "Campaign homebrew" : "Your homebrew";
}

export function ChoiceCardASI({
  featureSlug,
  currentChoice,
  feats,
  onSearch,
  onSelect,
}: ChoiceCardASIProps) {
  const [choiceMode, setChoiceMode] = useState<ChoiceMode>(
    currentChoice?.mode === "feat" ? "feat" : "ability",
  );
  const [abilityMode, setAbilityMode] = useState<AbilityMode>(() =>
    initialAbilityMode(currentChoice),
  );
  const [splitPicks, setSplitPicks] = useState<string[]>(() =>
    initialSplitPicks(currentChoice),
  );
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(feats);
  const [searching, setSearching] = useState(
    currentChoice?.mode === "feat" && Boolean(onSearch),
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequest = useRef(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestId = ++searchRequest.current;
    if (!onSearch || choiceMode !== "feat") return;

    const timer = window.setTimeout(() => {
      void onSearch(featureSlug, query.trim()).then(
        (results) => {
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
    if (!normalized) return feats;
    return feats.filter((feat) =>
      `${feat.name} ${feat.description}`.toLocaleLowerCase().includes(normalized),
    );
  }, [feats, onSearch, query, searchResults]);

  const isMade = currentChoice?.mode === "feat"
    || (currentChoice?.mode === "asi" &&
      (currentChoice.allocations.length === 1
        ? currentChoice.allocations[0]?.amount === 2
        : currentChoice.allocations.length === 2));

  async function persist(choice: AsiChoice) {
    setPending(true);
    setError(null);
    try {
      await onSelect(choice);
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "This choice could not be saved. Please try again.",
      );
      throw selectionError;
    } finally {
      setPending(false);
    }
  }

  function pickSingle(ability: string) {
    void persist({
      mode: "asi",
      allocations: [{ ability, amount: 2 }],
    }).catch(() => undefined);
  }

  function toggleSplit(ability: string) {
    let next: string[];
    if (splitPicks.includes(ability)) {
      next = splitPicks.filter((candidate) => candidate !== ability);
    } else if (splitPicks.length < 2) {
      next = [...splitPicks, ability];
    } else {
      next = [splitPicks[1], ability];
    }
    setSplitPicks(next);

    // A partial split is local draft state, not a completed character choice.
    if (next.length === 2) {
      void persist({
        mode: "asi",
        allocations: next.map((candidate) => ({
          ability: candidate,
          amount: 1,
        })) as AsiAllocation[],
      }).catch(() => undefined);
    }
  }

  function pickFeat(feat: UsableFeatOption) {
    if (!feat.prerequisiteMet || pending) return;
    void persist({
      mode: "feat",
      featId: feat.id,
      featVersion: feat.version,
      featName: feat.name,
    }).catch(() => undefined);
  }

  return (
    <article
      className="rounded-md border border-border bg-card/40 p-4"
      data-feature-slug={featureSlug}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <span
          aria-label={isMade ? "Choice made" : "Choice not yet made"}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            isMade
              ? "bg-accent/15 text-accent"
              : "bg-destructive/15 text-destructive",
          )}
        >
          {pending ? "Saving" : isMade ? "Chosen" : "Choose"}
        </span>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Improvement type">
        <button
          type="button"
          onClick={() => {
            setChoiceMode("ability");
            setSearching(false);
          }}
          aria-pressed={choiceMode === "ability"}
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            choiceMode === "ability"
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Ability scores
        </button>
        <button
          type="button"
          onClick={() => {
            setChoiceMode("feat");
            if (onSearch) {
              setSearching(true);
              setSearchError(null);
            }
          }}
          aria-pressed={choiceMode === "feat"}
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            choiceMode === "feat"
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Feat
        </button>
      </div>

      {choiceMode === "ability" ? (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAbilityMode("single")}
              aria-pressed={abilityMode === "single"}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                abilityMode === "single"
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              One ability by +2
            </button>
            <button
              type="button"
              onClick={() => setAbilityMode("split")}
              aria-pressed={abilityMode === "split"}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                abilityMode === "split"
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Two abilities by +1
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {ABILITIES.map((ability) => {
              const selected = abilityMode === "single"
                ? currentChoice?.mode === "asi"
                  && currentChoice.allocations.length === 1
                  && currentChoice.allocations[0]?.ability === ability
                  && currentChoice.allocations[0]?.amount === 2
                : splitPicks.includes(ability);

              return (
                <button
                  key={ability}
                  type="button"
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() =>
                    abilityMode === "single"
                      ? pickSingle(ability)
                      : toggleSplit(ability)
                  }
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-wait disabled:opacity-60",
                    selected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-card/30 hover:border-accent/50",
                  )}
                >
                  {ABBR[ability]} {abilityMode === "single" ? "+2" : "+1"}
                </button>
              );
            })}
          </div>
          {abilityMode === "split" && splitPicks.length === 1 && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              Choose one more ability to save this improvement.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentChoice?.mode === "feat" && (
            <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
              <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {currentChoice.featName}
              </span>
              <Badge variant="secondary">v{currentChoice.featVersion}</Badge>
            </div>
          )}

          <label className="relative block">
            <span className="sr-only">Search feats</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (onSearch) {
                  setSearching(true);
                  setSearchError(null);
                }
              }}
              placeholder="Search available feats"
              className="pl-9"
            />
          </label>

          {searching && (
            <p className="text-xs text-muted-foreground" role="status">
              Searching available feats…
            </p>
          )}
          {searchError && (
            <p className="text-sm text-destructive" role="alert">
              {searchError}
            </p>
          )}

          {!searching && (filteredFeats.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
              No available feats match this search.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredFeats.map((feat) => {
                const selected = currentChoice?.mode === "feat"
                  && currentChoice.featId === feat.id
                  && currentChoice.featVersion === feat.version;
                return (
                  <li key={`${feat.id}:${feat.version}`}>
                    <button
                      type="button"
                      disabled={pending || !feat.prerequisiteMet}
                      aria-pressed={selected}
                      onClick={() => pickFeat(feat)}
                      className={cn(
                        "w-full rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed",
                        selected
                          ? "border-accent bg-accent/10"
                          : "border-border bg-card/30 hover:border-accent/50",
                        !feat.prerequisiteMet && "opacity-60",
                      )}
                    >
                      <span className="flex items-start gap-3">
                        <Sparkles
                          className="mt-0.5 size-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{feat.name}</span>
                            <Badge variant="outline">v{feat.version}</Badge>
                            <Badge variant="secondary">{provenance(feat)}</Badge>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                            {feat.description}
                          </span>
                          {feat.prerequisiteReason && (
                            <span
                              className={cn(
                                "mt-2 block text-xs",
                                feat.prerequisiteMet
                                  ? "text-muted-foreground"
                                  : "font-medium text-destructive",
                              )}
                            >
                              {feat.prerequisiteReason}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
