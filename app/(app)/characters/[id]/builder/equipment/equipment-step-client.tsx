"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CharacterChoices } from "@/lib/types/character";

interface EquipmentStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    choices: CharacterChoices;
  };
  classContent: {
    id: string;
    name: string;
    slug: string;
    data: Record<string, unknown>;
  } | null;
}

export function EquipmentStepClient({
  characterId,
  character,
  classContent,
}: EquipmentStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [acknowledged, setAcknowledged] = useState<boolean>(
    !!character.choices?.starting_equipment,
  );

  // Equipment text from enriched class data (Phase 3)
  const equipmentText = classContent?.data?.equipment as string | undefined;
  // Legacy structured bundles (if any exist)
  const equipmentBundles =
    (classContent?.data?.starting_equipment as
      | Array<{ label: string; items: string[] }>
      | undefined) ?? [];
  const startingGold = classContent?.data?.starting_gold as string | undefined;

  // Parse equipment text into choice groups (split by semicolons)
  const equipmentGroups = equipmentText
    ? equipmentText.split(";").map((g) => g.trim()).filter(Boolean)
    : [];

  async function handleAcknowledge() {
    setAcknowledged(true);

    const newChoices = {
      ...character.choices,
      starting_equipment: "acknowledged",
    };

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  // Legacy bundle selection (keep for backward compatibility)
  async function handleSelectBundle(bundle: string) {
    const newChoices = {
      ...character.choices,
      starting_equipment: bundle,
    };

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Starting Equipment</h2>

      {equipmentGroups.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your {classContent?.name} starts with the following equipment.
            Choose from the options listed for each group.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Equipment Choices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {equipmentGroups.map((group, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Badge
                    variant="outline"
                    className="mt-0.5 shrink-0 text-xs"
                  >
                    {i + 1}
                  </Badge>
                  <p className="text-sm">{group}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {startingGold && (
            <p className="text-sm text-muted-foreground">
              Alternatively, you can start with <span className="font-medium">{startingGold}</span> and buy your own equipment.
            </p>
          )}

          {!acknowledged ? (
            <Button onClick={handleAcknowledge}>
              Confirm Equipment
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">Confirmed</Badge>
              Equipment selections acknowledged. Detailed inventory management coming in a future update.
            </div>
          )}
        </div>
      ) : equipmentBundles.length > 0 ? (
        /* Legacy structured bundles */
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose one of the starting equipment packages for your class.
          </p>
          {equipmentBundles.map((bundle, i) => {
            const bundleId = `bundle_${i}`;
            const isSelected = character.choices?.starting_equipment === bundleId;
            return (
              <Card
                key={bundleId}
                className={`cursor-pointer transition-colors ${
                  isSelected ? "border-primary bg-accent/50" : "hover:bg-accent/30"
                }`}
                onClick={() => handleSelectBundle(bundleId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? "border-primary" : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{bundle.label}</p>
                      <p className="text-xs text-muted-foreground">{bundle.items.join(", ")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipment</CardTitle>
            <CardDescription>
              {classContent
                ? "No starting equipment defined for this class."
                : "Select a class first to see starting equipment options."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Separator />

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/characters/${characterId}/builder/background`)
          }
        >
          Previous: Background
        </Button>
        <Button
          onClick={() => router.push(`/characters/${characterId}`)}
        >
          Finish &amp; View Character
        </Button>
      </div>
    </div>
  );
}
