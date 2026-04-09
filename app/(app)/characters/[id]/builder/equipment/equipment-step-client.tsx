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
  const [selected, setSelected] = useState<string>(
    character.choices?.starting_equipment ?? "",
  );

  // Try to get equipment bundles from class data
  const equipmentBundles =
    (classContent?.data?.starting_equipment as
      | Array<{ label: string; items: string[] }>
      | undefined) ?? [];
  const startingGold = classContent?.data?.starting_gold as string | undefined;

  async function handleSelect(bundle: string) {
    setSelected(bundle);

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

      {equipmentBundles.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose one of the starting equipment packages for your class.
          </p>
          {equipmentBundles.map((bundle, i) => {
            const bundleId = `bundle_${i}`;
            const isSelected = selected === bundleId;

            return (
              <Card
                key={bundleId}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "border-primary bg-accent/50"
                    : "hover:bg-accent/30"
                }`}
                onClick={() => handleSelect(bundleId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? "border-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{bundle.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {bundle.items.join(", ")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {startingGold && (
            <Card
              className={`cursor-pointer transition-colors ${
                selected === "gold"
                  ? "border-primary bg-accent/50"
                  : "hover:bg-accent/30"
              }`}
              onClick={() => handleSelect("gold")}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selected === "gold"
                        ? "border-primary"
                        : "border-muted-foreground"
                    }`}
                  >
                    {selected === "gold" && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Starting Gold</p>
                    <p className="text-xs text-muted-foreground">
                      {startingGold}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipment</CardTitle>
            <CardDescription>
              {classContent
                ? "No starting equipment bundles defined for this class."
                : "Select a class first to see starting equipment options."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Full equipment and inventory management will be available in a
              future update.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/characters/${characterId}/builder/abilities`)
          }
        >
          Previous: Abilities
        </Button>
        <Button
          onClick={() => router.push(`/characters/${characterId}`)}
        >
          Finish &amp; Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
