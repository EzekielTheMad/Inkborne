import Link from "next/link";
import { BookMarked, Filter, Search, Sparkles } from "lucide-react";

import { CompendiumRow } from "@/components/compendium/compendium-row";
import { buttonVariants } from "@/components/ui/button";
import {
  COMPENDIUM_CATEGORIES,
  COMPENDIUM_CATEGORY_KEYS,
  COMPENDIUM_FILTER_OPTIONS,
  compendiumHref,
  resetCategoryFilters,
  type CompendiumQuery,
} from "@/lib/compendium/catalog";
import type {
  CompendiumResultPage,
  CompendiumSystem,
} from "@/lib/compendium/types";
import { cn } from "@/lib/utils";

interface CompendiumBrowserProps {
  systems: CompendiumSystem[];
  query: CompendiumQuery;
  result: CompendiumResultPage;
  userId: string;
}

const filterFieldClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CompendiumBrowser({
  systems,
  query,
  result,
  userId,
}: CompendiumBrowserProps) {
  const category = COMPENDIUM_CATEGORIES[query.category];
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const firstResult = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastResult = Math.min(result.page * result.pageSize, result.total);
  const cleared = resetCategoryFilters(
    { ...query, q: "", provenance: "all", sort: "name-asc" },
    query.category,
  );
  const currentHref = compendiumHref(query);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="j-folio">Rules you can use</p>
          <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-4xl">
            Library
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Browse SRD rules, your own homebrew, and content shared through your campaigns.
            Players and DMs see the same authorized catalog.
          </p>
        </div>
        <Link href="/homebrew" className={buttonVariants({ variant: "gold" })}>
          <Sparkles className="size-4" />
          Open Homebrew
        </Link>
      </header>

      <nav
        aria-label="Library categories"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8"
      >
        {COMPENDIUM_CATEGORY_KEYS.map((key) => {
          const item = COMPENDIUM_CATEGORIES[key];
          const active = key === query.category;
          const next = resetCategoryFilters(query, key);
          return (
            <Link
              key={key}
              href={compendiumHref(next)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg border px-3 py-3 text-center text-xs font-medium transition-colors",
                active
                  ? "border-accent bg-accent/12 text-accent"
                  : "border-border bg-card/60 text-muted-foreground hover:border-accent/45 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <section className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <form
          method="get"
          action="/library"
          className="j-card-paper h-fit space-y-5 p-5 lg:sticky lg:top-24"
          aria-label="Filter library"
        >
          <input type="hidden" name="category" value={query.category} />
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-accent" />
            <h2 className="j-folio">Find rules</h2>
          </div>

          <Field label="Game system" htmlFor="library-system">
            <select
              id="library-system"
              name="system"
              defaultValue={query.system ?? ""}
              className={filterFieldClassName}
            >
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}{system.versionLabel ? ` · ${system.versionLabel}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Search by name" htmlFor="library-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="library-search"
                name="q"
                type="search"
                defaultValue={query.q}
                maxLength={120}
                placeholder={`Search ${category.label.toLowerCase()}…`}
                className={`${filterFieldClassName} pl-9`}
              />
            </div>
          </Field>

          <Field label="Access" htmlFor="library-provenance">
            <select
              id="library-provenance"
              name="provenance"
              defaultValue={query.provenance}
              className={filterFieldClassName}
            >
              <option value="all">Everything I can access</option>
              <option value="srd">SRD</option>
              <option value="mine">My homebrew</option>
              <option value="shared">Campaign shared</option>
            </select>
          </Field>

          <CategoryFilters query={query} />

          <Field label="Sort" htmlFor="library-sort">
            <select
              id="library-sort"
              name="sort"
              defaultValue={query.sort}
              className={filterFieldClassName}
            >
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="newest">Newest first</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="submit" className={buttonVariants({ variant: "gold" })}>
              Apply
            </button>
            <Link
              href={compendiumHref(cleared)}
              className={buttonVariants({ variant: "outline" })}
            >
              Clear
            </Link>
          </div>
        </form>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BookMarked className="size-4 text-accent" />
                <h2 className="j-display text-2xl text-foreground">{category.label}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
              {result.total === 0
                ? "No entries"
                : `${firstResult}–${lastResult} of ${result.total}`}
            </p>
          </div>

          {result.entries.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.entries.map((entry) => (
                <CompendiumRow
                  key={entry.id}
                  entry={entry}
                  userId={userId}
                  returnHref={currentHref}
                />
              ))}
            </div>
          ) : (
            <div className="j-card-paper flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <BookMarked className="size-7 text-accent" />
              <h3 className="j-display mt-4 text-xl text-foreground">No matching rules</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Try clearing a filter or searching another category. Private content from
                people outside your campaigns will never appear here.
              </p>
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Library pages" className="flex items-center justify-between pt-3">
              {result.page > 1 ? (
                <Link
                  href={compendiumHref(query, { page: result.page - 1 })}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Previous
                </Link>
              ) : <span />}
              <span className="text-xs text-muted-foreground">
                Page {result.page} of {totalPages}
              </span>
              {result.page < totalPages ? (
                <Link
                  href={compendiumHref(query, { page: result.page + 1 })}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Next
                </Link>
              ) : <span />}
            </nav>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function CategoryFilters({ query }: { query: CompendiumQuery }) {
  if (query.category === "spells") {
    return (
      <>
        <Field label="Spell level" htmlFor="library-level">
          <select id="library-level" name="level" defaultValue={query.level ?? ""} className={filterFieldClassName}>
            <option value="">Any level</option>
            <option value="0">Cantrip</option>
            {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
              <option key={level} value={level}>Level {level}</option>
            ))}
          </select>
        </Field>
        <Field label="School" htmlFor="library-school">
          <select id="library-school" name="school" defaultValue={query.school ?? ""} className={`${filterFieldClassName} capitalize`}>
            <option value="">Any school</option>
            {COMPENDIUM_FILTER_OPTIONS.magicSchools.map((school) => (
              <option key={school} value={school}>{school}</option>
            ))}
          </select>
        </Field>
        <Toggle name="ritual" label="Ritual only" checked={query.ritual} />
        <Toggle name="concentration" label="Concentration only" checked={query.concentration} />
      </>
    );
  }

  if (query.category === "items") {
    return (
      <>
        <Field label="Rarity" htmlFor="library-rarity">
          <select id="library-rarity" name="rarity" defaultValue={query.rarity ?? ""} className={filterFieldClassName}>
            <option value="">Any rarity</option>
            {COMPENDIUM_FILTER_OPTIONS.itemRarities.map((rarity) => (
              <option key={rarity} value={rarity}>{rarity}</option>
            ))}
          </select>
        </Field>
        <Field label="Magic item attunement" htmlFor="library-attunement">
          <select id="library-attunement" name="attunement" defaultValue={query.attunement ?? ""} className={filterFieldClassName}>
            <option value="">Any</option>
            <option value="required">Required</option>
            <option value="not-required">Not required</option>
          </select>
        </Field>
      </>
    );
  }

  if (query.category === "races") {
    return (
      <Field label="Size" htmlFor="library-size">
        <select id="library-size" name="size" defaultValue={query.size ?? ""} className={filterFieldClassName}>
          <option value="">Any size</option>
          {COMPENDIUM_FILTER_OPTIONS.creatureSizes.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </Field>
    );
  }

  if (query.category === "classes") {
    return (
      <Field label="Hit die" htmlFor="library-hit-die">
        <select id="library-hit-die" name="hitDie" defaultValue={query.hitDie ?? ""} className={filterFieldClassName}>
          <option value="">Any hit die</option>
          {[6, 8, 10, 12].map((die) => <option key={die} value={die}>d{die}</option>)}
        </select>
      </Field>
    );
  }

  if (query.category === "weapons") {
    return (
      <>
        <Field label="Weapon category" htmlFor="library-weapon-category">
          <select id="library-weapon-category" name="weaponCategory" defaultValue={query.weaponCategory ?? ""} className={filterFieldClassName}>
            <option value="">Any category</option>
            {COMPENDIUM_FILTER_OPTIONS.weaponCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </Field>
        <Field label="Range" htmlFor="library-weapon-range">
          <select id="library-weapon-range" name="weaponRange" defaultValue={query.weaponRange ?? ""} className={filterFieldClassName}>
            <option value="">Melee or ranged</option>
            {COMPENDIUM_FILTER_OPTIONS.weaponRanges.map((range) => (
              <option key={range} value={range}>{range}</option>
            ))}
          </select>
        </Field>
      </>
    );
  }

  if (query.category === "armor") {
    return (
      <Field label="Armor category" htmlFor="library-armor-category">
        <select id="library-armor-category" name="armorCategory" defaultValue={query.armorCategory ?? ""} className={filterFieldClassName}>
          <option value="">Any category</option>
          {COMPENDIUM_FILTER_OPTIONS.armorCategories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </Field>
    );
  }

  return null;
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={checked}
        className="size-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}
