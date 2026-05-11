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

const ABILITY_ABBR = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

function formatScoresPreview(scores: number[]): string {
  return scores
    .map((v, i) => (v !== 0 ? `${v > 0 ? "+" : ""}${v} ${ABILITY_ABBR[i]}` : null))
    .filter(Boolean)
    .join(", ");
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
            {typeof content.data.primaryAbility === "string" && (
              <div>
                <span className="font-medium">Primary Ability: </span>
                <span>{content.data.primaryAbility}</span>
              </div>
            )}
            {/* Speed — prefer speed_detail over flat speed */}
            {content.data.speed_detail != null ? (
              <div>
                <span className="font-medium">Speed: </span>
                <span>
                  {Object.entries(content.data.speed_detail as Record<string, number>)
                    .filter(([key]) => key !== "encumbered")
                    .map(([type, spd]) => type === "walk" ? `${spd} ft` : `${formatSlug(type)} ${spd} ft`)
                    .join(", ")}
                </span>
              </div>
            ) : content.data.speed != null ? (
              <div>
                <span className="font-medium">Speed: </span>
                <span>{String(content.data.speed)} ft.</span>
              </div>
            ) : null}
            {content.data.size != null && (
              <div>
                <span className="font-medium">Size: </span>
                <span className="capitalize">{String(content.data.size)}</span>
              </div>
            )}
            {/* Race: Ability Scores */}
            {Array.isArray(content.data.scores) && (
              <div>
                <span className="font-medium">Ability Scores: </span>
                <span>{formatScoresPreview(content.data.scores as number[])}</span>
              </div>
            )}
            {/* Race: Vision */}
            {Array.isArray(content.data.vision) && (content.data.vision as Array<{type: string; range: number}>).length > 0 && (
              <div>
                <span className="font-medium">Vision: </span>
                <span className="capitalize">
                  {(content.data.vision as Array<{type: string; range: number}>)
                    .map((v) => `${v.type} ${v.range} ft`)
                    .join(", ")}
                </span>
              </div>
            )}
            {/* Race: Damage Resistances */}
            {Array.isArray(content.data.dmgres) && (content.data.dmgres as string[]).length > 0 && (
              <div>
                <span className="font-medium">Damage Resistance: </span>
                <span className="capitalize">{(content.data.dmgres as string[]).join(", ")}</span>
              </div>
            )}
            {/* Background: Skills */}
            {Array.isArray(content.data.skills) && (content.data.skills as string[]).length > 0 && (
              <div>
                <span className="font-medium">Skills: </span>
                <span>{(content.data.skills as string[]).map(formatSlug).join(", ")}</span>
              </div>
            )}
            {/* Background: Gold */}
            {content.data.gold != null && (
              <div>
                <span className="font-medium">Starting Gold: </span>
                <span>{String(content.data.gold)} gp</span>
              </div>
            )}
            {/* Class: Equipment */}
            {typeof content.data.equipment === "string" && (
              <div>
                <span className="font-medium">Equipment: </span>
                <span>{content.data.equipment}</span>
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

          {/* Stat Modifiers — only show non-ability-score effects not already covered above */}
          {(() => {
            // Filter out ability scores (shown in enriched section) and internal stats
            const ABILITY_SLUGS = new Set(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]);
            const HIDDEN_STATS = new Set(["movement_speed", "size", "hit_die"]);
            const displayMechanicals = mechanicals.filter(
              (m) => !ABILITY_SLUGS.has(m.stat) && !HIDDEN_STATS.has(m.stat),
            );
            if (displayMechanicals.length === 0) return null;
            return (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-1">Stat Modifiers</p>
                  <div className="text-sm text-muted-foreground">
                    {displayMechanicals.map((m, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        {formatSlug(m.stat)} {m.op === "add" && typeof m.value === "number" && m.value > 0 ? "+" : ""}{String(m.value ?? m.expr ?? "")}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-character-fg text-background hover:opacity-90"
            onClick={() => onConfirm(content)}
          >
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

  // Structured proficiencies from enriched data (Phase 3)
  const armorProfsData = content.data.armorProfs as { primary?: string[]; secondary?: string[] } | undefined;
  const weaponProfsData = content.data.weaponProfs as { primary?: string[]; secondary?: string[] } | undefined;
  const toolProfsData = content.data.toolProfs as string[] | Array<{ choose: number; from: string }> | undefined;

  if (armorProfsData?.primary?.length) {
    for (const p of armorProfsData.primary) addTo("Armor", formatSlug(p));
  }
  if (weaponProfsData?.primary?.length) {
    for (const p of weaponProfsData.primary) addTo("Weapons", formatSlug(p));
  }
  if (Array.isArray(toolProfsData)) {
    for (const t of toolProfsData) {
      if (typeof t === "string") addTo("Tools", formatSlug(t));
      else if (typeof t === "object" && t.choose) addTo("Tools", `Choose ${t.choose} from ${t.from}`);
    }
  }

  // Starting proficiencies from data (legacy)
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
