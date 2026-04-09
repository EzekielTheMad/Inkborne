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
      return choices.starting_equipment ?? "Not selected";
    default:
      return "Not started";
  }
}

function getStepStatus(
  step: CreationStep,
  choices: CharacterChoices,
  baseStats: Record<string, number>,
): "complete" | "in_progress" | "untouched" {
  switch (step.type) {
    case "class":
      return choices.classes?.length ? "complete" : "untouched";
    case "race":
      return choices.race ? "complete" : "untouched";
    case "background":
      return choices.background ? "complete" : "untouched";
    case "abilities":
      if (choices.ability_method && Object.keys(baseStats).length > 0)
        return "complete";
      if (choices.ability_method) return "in_progress";
      return "untouched";
    case "equipment":
      return choices.starting_equipment ? "complete" : "untouched";
    default:
      return "untouched";
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

  const schema = character.game_systems?.schema_definition;
  const steps: CreationStep[] = schema?.creation_steps ?? [];
  const choices: CharacterChoices = character.choices ?? {};
  const baseStats: Record<string, number> = character.base_stats ?? {};

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Complete each step to build your character. Steps can be done in any
        order.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => {
          const status = getStepStatus(step, choices, baseStats);
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
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
