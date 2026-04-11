"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ContentEntry } from "./content-browser";
import type { Effect, GrantEffect, MechanicalEffect } from "@/lib/types/effects";

interface ContentPreviewProps {
  content: ContentEntry | null;
  contentTypeLabel: string;
  onConfirm: (content: ContentEntry) => void;
  onCancel: () => void;
  /** Optional list of feature entries for resolving feature slugs to names/descriptions */
  features?: ContentEntry[];
}

function formatSlug(slug: string): string {
  return slug
    .replace(/^save_/, "")
    .replace(/^skill-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatChoice(effect: Effect): string {
  if (effect.type !== "choice") return "";
  const type = effect.grant_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const plural = effect.choose > 1
    ? type.endsWith("y") ? type.slice(0, -1) + "ies" : type + "s"
    : type;
  return `Choose ${effect.choose} ${plural}`;
}

export function ContentPreview({
  content,
  contentTypeLabel,
  onConfirm,
  onCancel,
  features,
}: ContentPreviewProps) {
  if (!content) return null;

  const grants = content.effects.filter(
    (e): e is GrantEffect => e.type === "grant",
  );
  const mechanicals = content.effects.filter(
    (e): e is MechanicalEffect => e.type === "mechanical",
  );
  const choices = content.effects.filter((e) => e.type === "choice");

  // Build merged proficiencies list
  const profCategories = buildProficiencyCategories(content, grants, choices);

  // Get all level features for classes
  const levelFeatures = getClassLevelFeatures(content, features);

  return (
    <Dialog open={!!content} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{content.name}</DialogTitle>
          <DialogDescription className="capitalize">
            {content.source === "srd" ? "SRD" : "Homebrew"}{" "}
            {contentTypeLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          {typeof content.data.description === "string" && (
            <p className="text-sm text-foreground">
              {content.data.description}
            </p>
          )}

          {/* Key stats line */}
          <div className="text-sm space-y-0.5">
            {content.data.hit_die != null && (
              <div>
                <span className="font-medium">Hit Die: </span>
                <span>d{String(content.data.hit_die)}</span>
              </div>
            )}
            {content.data.speed != null && (
              <div>
                <span className="font-medium">Speed: </span>
                <span>{String(content.data.speed)} ft.</span>
              </div>
            )}
            {content.data.size != null && (
              <div>
                <span className="font-medium">Size: </span>
                <span className="capitalize">{String(content.data.size)}</span>
              </div>
            )}
          </div>

          {/* Proficiencies — merged categorized list */}
          {profCategories.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Proficiencies</p>
                <div className="text-sm space-y-1">
                  {profCategories.map(({ label, items }) => (
                    <div key={label}>
                      <span className="font-medium">{label}: </span>
                      <span className="text-muted-foreground">{items.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Level features — all levels for classes */}
          {levelFeatures.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Class Features</p>
                <div className="space-y-3">
                  {levelFeatures.map(({ level, featureList }) => (
                    <div key={level}>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                        {level === 1 ? "1st Level" : level === 2 ? "2nd Level" : level === 3 ? "3rd Level" : `${level}th Level`}
                      </p>
                      <div className="space-y-2">
                        {featureList.map((feat, i) => (
                          <div key={i} className="rounded-md border border-border bg-muted/50 px-3 py-2">
                            <p className="text-sm font-medium text-accent">
                              {feat.name}
                            </p>
                            {feat.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {feat.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Race-specific: traits */}
          {Array.isArray(content.data.traits) && (content.data.traits as string[]).length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Traits</p>
                <div className="space-y-2">
                  {(content.data.traits as string[]).map((traitSlug, i) => {
                    const traitEntry = features?.find((f) => f.slug === traitSlug);
                    const description = traitEntry?.data?.description;
                    return (
                      <div key={i} className="rounded-md border border-border bg-muted/50 px-3 py-2">
                        <p className="text-sm font-medium text-accent">
                          {traitEntry?.name ?? formatSlug(traitSlug)}
                        </p>
                        {typeof description === "string" && description.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Stat Bonuses */}
          {mechanicals.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-1">Stat Bonuses</p>
                <div className="text-sm text-muted-foreground">
                  {mechanicals.map((m, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      {formatSlug(m.stat)} {m.op === "add" ? "+" : ""}{String(m.value ?? m.expr ?? "")}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(content)}>
            Add {contentTypeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Helpers ---

interface ProfCategory {
  label: string;
  items: string[];
}

function buildProficiencyCategories(
  content: ContentEntry,
  grants: GrantEffect[],
  choices: Effect[],
): ProfCategory[] {
  const categories: Record<string, string[]> = {};

  function addTo(cat: string, item: string) {
    if (!categories[cat]) categories[cat] = [];
    if (!categories[cat].includes(item)) categories[cat].push(item);
  }

  // Saving throws from data
  const savingThrows = (content.data.saving_throws as string[] | undefined) ?? [];
  for (const s of savingThrows) {
    addTo("Saving Throws", formatSlug(s));
  }

  // Saving throws from grants
  for (const g of grants) {
    if (g.stat.startsWith("save_")) {
      addTo("Saving Throws", formatSlug(g.stat));
    }
  }

  // Starting proficiencies from data
  const startingProfs = (content.data.starting_proficiencies as string[] | undefined) ?? [];
  for (const prof of startingProfs) {
    const slug = prof.toLowerCase();
    const label = formatSlug(prof);
    if (slug.includes("armor") || slug === "shields" || slug.includes("all-armor")) {
      addTo("Armor", label);
    } else if (slug.includes("weapon") || slug.includes("sword") || slug.includes("crossbow") || slug.includes("dagger") || slug.includes("rapier") || slug.includes("axe") || slug.includes("bow") || slug.includes("mace") || slug.includes("staff") || slug.includes("quarterstaff")) {
      addTo("Weapons", label);
    } else if (slug.includes("saving-throw") || slug.includes("save")) {
      // skip — handled above
    } else if (slug.includes("tool") || slug.includes("kit") || slug.includes("supplies") || slug.includes("instrument")) {
      addTo("Tools", label);
    } else {
      addTo("Other", label);
    }
  }

  // Skills from choices
  for (const c of choices) {
    if (c.type === "choice") {
      addTo("Skills", formatChoice(c));
    }
  }

  // Non-save grants as skills
  for (const g of grants) {
    if (!g.stat.startsWith("save_")) {
      // Don't add here — they're redundant with starting_proficiencies
    }
  }

  // Build ordered output
  const order = ["Armor", "Weapons", "Tools", "Saving Throws", "Skills", "Other"];
  const result: ProfCategory[] = [];
  for (const key of order) {
    if (categories[key] && categories[key].length > 0) {
      result.push({ label: key, items: categories[key] });
    }
  }
  return result;
}

interface LevelFeatureGroup {
  level: number;
  featureList: Array<{ name: string; description?: string }>;
}

function getClassLevelFeatures(
  content: ContentEntry,
  features?: ContentEntry[],
): LevelFeatureGroup[] {
  const levels = content.data.levels as Array<{ level: number; features: string[] }> | undefined;
  if (!Array.isArray(levels)) return [];

  const result: LevelFeatureGroup[] = [];

  for (const lvl of levels) {
    if (!lvl.features || lvl.features.length === 0) continue;

    const featureList = lvl.features.map((featureSlug) => {
      const featureEntry = features?.find((f) => f.slug === featureSlug);
      const description = featureEntry?.data?.description;
      return {
        name: featureEntry?.name ?? formatSlug(featureSlug),
        description: typeof description === "string" ? description : undefined,
      };
    });

    result.push({ level: lvl.level, featureList });
  }

  return result;
}
