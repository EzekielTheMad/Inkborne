import Link from "next/link";
import { ArrowLeft, BookMarked } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  getCompendiumEntryDescription,
  getCompendiumEntryEyebrow,
  getCompendiumEntryFacts,
} from "@/lib/compendium/presentation";
import {
  getCompendiumProvenance,
  type CompendiumEntry,
} from "@/lib/compendium/types";

interface CompendiumDetailProps {
  entry: CompendiumEntry;
  userId: string;
  returnHref: string;
}

export function CompendiumDetail({ entry, userId, returnHref }: CompendiumDetailProps) {
  const provenance = getCompendiumProvenance(entry, userId);
  const facts = getCompendiumEntryFacts(entry);

  return (
    <article className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <Link href={returnHref} className={buttonVariants({ variant: "ghost" })}>
        <ArrowLeft className="size-4" />
        Back to Library
      </Link>

      <header className="j-card-paper overflow-hidden">
        <div className="border-b border-border bg-gradient-to-br from-accent/15 via-transparent to-transparent px-6 py-8 sm:px-9 sm:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="j-folio text-muted-foreground">{getCompendiumEntryEyebrow(entry)}</p>
              <h1 className="j-display mt-2 text-3xl text-foreground sm:text-5xl">{entry.name}</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant={provenance === "SRD" ? "secondary" : "outline"}>{provenance}</Badge>
                <Badge variant="outline">Version {entry.version}</Badge>
              </div>
            </div>
            <BookMarked className="hidden size-9 text-accent sm:block" aria-hidden="true" />
          </div>
        </div>

        <div className="grid gap-8 px-6 py-7 sm:px-9 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-8">
            <section aria-labelledby="entry-description-heading">
              <h2 id="entry-description-heading" className="j-folio">Description</h2>
              <div className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground/90">
                {getCompendiumEntryDescription(entry)}
              </div>
            </section>
            <ExtendedRules entry={entry} />
          </div>

          <aside aria-label="Rule details" className="rounded-lg border border-border bg-muted/25 p-5">
            <h2 className="j-folio">At a glance</h2>
            {facts.length > 0 ? (
              <dl className="mt-4 space-y-4">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-foreground">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No additional structured details.</p>
            )}
          </aside>
        </div>
      </header>

      <p className="text-center text-xs text-muted-foreground">
        This view is read-only. Manage content you own from Homebrew.
      </p>
    </article>
  );
}

function ExtendedRules({ entry }: { entry: CompendiumEntry }) {
  if (entry.content_type === "class") {
    const levels = Array.isArray(entry.data.levels)
      ? entry.data.levels.filter(isRecord)
      : [];
    if (levels.length === 0) return null;

    return (
      <section aria-labelledby="class-progression-heading">
        <h2 id="class-progression-heading" className="j-folio">Class progression</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-muted/45 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Level</th>
                <th className="px-3 py-2 font-semibold">Features</th>
                <th className="px-3 py-2 font-semibold">Spell slots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {levels.map((level, index) => {
                const spellcasting = isRecord(level.spellcasting) ? level.spellcasting : null;
                const slots = Array.isArray(spellcasting?.spell_slots)
                  ? spellcasting.spell_slots.filter((slot): slot is number => typeof slot === "number")
                  : [];
                return (
                  <tr key={`${String(level.level ?? index + 1)}-${index}`}>
                    <td className="px-3 py-2 align-top font-medium text-foreground">
                      {String(level.level ?? index + 1)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {stringList(level.features).map(formatSlug).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {slots.some((slot) => slot > 0)
                        ? slots.map((slot, slotIndex) => slot > 0 ? `${slotIndex + 1}:${slot}` : null).filter(Boolean).join(" · ")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (entry.content_type === "background") {
    return (
      <TextCollections
        sections={[
          ["Personality traits", stringList(entry.data.personality_traits)],
          ["Ideals", Array.isArray(entry.data.ideals)
            ? entry.data.ideals.map((ideal) => isRecord(ideal) && typeof ideal.text === "string" ? ideal.text : "").filter(Boolean)
            : []],
          ["Bonds", stringList(entry.data.bonds)],
          ["Flaws", stringList(entry.data.flaws)],
        ]}
      />
    );
  }

  if (entry.content_type === "race") {
    return (
      <TextCollections
        sections={[
          ["Age", stringValue(entry.data.age_description)],
          ["Alignment", stringValue(entry.data.alignment_description)],
          ["Size", stringValue(entry.data.size_description)],
          ["Languages", stringValue(entry.data.language_description)],
        ].map(([label, value]) => [label, value ? [value] : []])}
      />
    );
  }

  if (entry.content_type === "spell") {
    const higherLevel = stringValue(entry.data.higher_level);
    if (!higherLevel) return null;
    return (
      <section aria-labelledby="higher-level-heading">
        <h2 id="higher-level-heading" className="j-folio">At higher levels</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground/90">{higherLevel}</p>
      </section>
    );
  }

  return null;
}

function TextCollections({
  sections,
}: {
  sections: Array<[string, string[]]>;
}) {
  const visible = sections.filter(([, values]) => values.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {visible.map(([label, values]) => (
        <section key={label}>
          <h2 className="j-folio">{label}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {values.map((value, index) => <li key={`${label}-${index}`}>{value}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function formatSlug(value: string): string {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
