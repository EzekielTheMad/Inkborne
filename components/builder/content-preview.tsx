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
import { Badge } from "@/components/ui/badge";
import type { ContentEntry } from "./content-browser";
import type { Effect, GrantEffect, MechanicalEffect } from "@/lib/types/effects";

interface ContentPreviewProps {
  content: ContentEntry | null;
  contentTypeLabel: string;
  onConfirm: (content: ContentEntry) => void;
  onCancel: () => void;
}

function formatEffect(effect: Effect): string {
  switch (effect.type) {
    case "mechanical":
      return `${effect.stat}: ${effect.op} ${effect.value ?? effect.expr ?? ""}`;
    case "grant":
      return `${effect.stat}: ${effect.value}`;
    case "narrative":
      return effect.text;
    case "choice":
      return `Choose ${effect.choose} ${effect.grant_type}`;
    default:
      return "";
  }
}

export function ContentPreview({
  content,
  contentTypeLabel,
  onConfirm,
  onCancel,
}: ContentPreviewProps) {
  if (!content) return null;

  const grants = content.effects.filter(
    (e): e is GrantEffect => e.type === "grant",
  );
  const mechanicals = content.effects.filter(
    (e): e is MechanicalEffect => e.type === "mechanical",
  );
  const choices = content.effects.filter((e) => e.type === "choice");

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
          {typeof content.data.description === "string" && (
            <p className="text-sm text-foreground">
              {content.data.description}
            </p>
          )}

          {/* Key stats from data */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {content.data.hit_die != null && (
              <div>
                <span className="text-muted-foreground">Hit Die: </span>
                <span className="font-medium">d{String(content.data.hit_die)}</span>
              </div>
            )}
            {content.data.speed != null && (
              <div>
                <span className="text-muted-foreground">Speed: </span>
                <span className="font-medium">{String(content.data.speed)} ft</span>
              </div>
            )}
            {content.data.size != null && (
              <div>
                <span className="text-muted-foreground">Size: </span>
                <span className="font-medium capitalize">
                  {String(content.data.size)}
                </span>
              </div>
            )}
            {content.data.primary_ability != null && (
              <div>
                <span className="text-muted-foreground">Primary: </span>
                <span className="font-medium capitalize">
                  {String(content.data.primary_ability)}
                </span>
              </div>
            )}
          </div>

          {/* Class-specific: saving throws, proficiencies, level 1 features */}
          {Array.isArray(content.data.saving_throws) && (content.data.saving_throws as string[]).length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Saves: </span>
              <span className="font-medium capitalize">
                {(content.data.saving_throws as string[]).join(" & ")}
              </span>
            </div>
          )}
          {Array.isArray(content.data.starting_proficiencies) && (content.data.starting_proficiencies as string[]).length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-1">Proficiencies</p>
                <div className="flex flex-wrap gap-1.5">
                  {(content.data.starting_proficiencies as string[]).map((prof, i) => (
                    <Badge key={i} variant="secondary" className="text-xs capitalize">
                      {prof.replace(/-/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
          {Array.isArray(content.data.levels) && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Level 1 Features</p>
                <div className="space-y-1.5">
                  {((content.data.levels as Array<{ level: number; features: string[] }>)
                    .find((l) => l.level === 1)?.features ?? [])
                    .map((feature, i) => (
                      <div key={i} className="text-sm rounded-md bg-muted px-3 py-2 capitalize">
                        {feature.replace(/-/g, " ")}
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
                <div className="space-y-1.5">
                  {(content.data.traits as string[]).map((trait, i) => (
                    <div key={i} className="text-sm rounded-md bg-muted px-3 py-2 capitalize">
                      {trait.replace(/-/g, " ")}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Grants */}
          {grants.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Proficiencies & Grants</p>
                <div className="flex flex-wrap gap-1.5">
                  {grants.map((g, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {g.stat}: {g.value}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Mechanical effects */}
          {mechanicals.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Stat Bonuses</p>
                <div className="flex flex-wrap gap-1.5">
                  {mechanicals.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {formatEffect(m)}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Choices */}
          {choices.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Choices to Resolve</p>
                <div className="space-y-1">
                  {choices.map((c, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {formatEffect(c)}
                    </p>
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
