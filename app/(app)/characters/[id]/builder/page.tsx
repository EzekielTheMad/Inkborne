import { getContentByType } from "@/lib/supabase/content-definitions";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  describeStartingEquipment,
} from "@/lib/builder/equipment-choices";
import { getBuilderStepStatus, builderStepStatusLabels } from "@/lib/builder/step-status";
import type { CreationStep } from "@/lib/types/system";
import type { CharacterChoices } from "@/lib/types/character";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getStepSummary(
  step: CreationStep,
  choices: CharacterChoices,
): string {
  switch (step.type) {
    case "class":
      return choices.classes?.length
        ? choices.classes
            .map((c) => `${c.slug} ${c.level}`)
            .join(", ")
        : "Not selected";
    case "race":
      return choices.race
        ? `${choices.race}${choices.subrace ? ` (${choices.subrace})` : ""}`
        : "Not selected";
    case "background":
      return choices.background ?? "Not selected";
    case "abilities":
      return choices.ability_method ?? "Not selected";
    case "equipment":
      return describeStartingEquipment(choices.starting_equipment);
    default:
      return "Not started";
  }
}

export default async function BuilderOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character) notFound();

  const contentRefs = await getContentRefsByCharacter(id);
  const hasLanguageCategory = contentRefs.some(ref => ref.content_definitions.effects?.some(effect => effect.type === "choice" && effect.from === "all_languages"));
  // A failed catalog read leaves category choices incomplete; it never upgrades a pin.
  const languages = hasLanguageCategory
    ? await getContentByType(character.system_id, "language").then(rows => rows.map(row => row.slug)).catch(() => undefined)
    : undefined;
  const schema = character.game_systems?.schema_definition;
  const steps: CreationStep[] = schema?.creation_steps ?? [];
  const choices: CharacterChoices = character.choices ?? {};
  const baseStats: Record<string, number> = character.base_stats ?? {};

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Complete each step to build your character. Steps can be done in any
        order. Saved selections can still have class-level choices to finish.
        Review those choices and equipment before playing.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => {
          const status = getBuilderStepStatus(step.type, choices, baseStats, schema, contentRefs, languages);
          const summary = getStepSummary(step, choices);

          return (
            <Link
              key={step.type}
              href={`/characters/${id}/builder/${step.type}`}
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                        status === "complete" &&
                          "bg-green-500/10 text-green-500",
                        status === "in_progress" &&
                          "bg-blue-500/10 text-blue-500",
                        status === "untouched" &&
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {status === "complete" ? "\u2713" : index + 1}
                    </span>
                    <CardTitle className="text-base">{step.label}</CardTitle>
                    <span className="text-xs text-muted-foreground">{builderStepStatusLabels[status]}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p
                    className={cn(
                      "text-sm capitalize",
                      status === "untouched"
                        ? "text-muted-foreground italic"
                        : "text-foreground",
                    )}
                  >
                    {summary}
                  </p>
                  {["race", "class", "background"].includes(step.type) && status === "in_progress" && (
                    <p className="mt-2 text-xs text-muted-foreground">Review the saved details in this step to finish your selection.</p>
                  )}
                  {step.type === "abilities" && status === "in_progress" && choices.ability_method && (
                    <p className="mt-2 text-xs text-muted-foreground">Assign a valid base score to every ability using the selected method.</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
