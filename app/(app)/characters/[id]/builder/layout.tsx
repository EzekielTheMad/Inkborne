import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BuilderStepNav } from "@/components/builder/builder-step-nav";
import type { CreationStep } from "@/lib/types/system";
import type { CharacterChoices } from "@/lib/types/character";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

function computeStepStatus(
  steps: CreationStep[],
  choices: CharacterChoices,
  baseStats: Record<string, number>,
): Record<string, "complete" | "in_progress" | "untouched"> {
  const status: Record<string, "complete" | "in_progress" | "untouched"> = {};

  for (const step of steps) {
    switch (step.type) {
      case "class":
        if (choices.classes && choices.classes.length > 0) {
          status.class = "complete";
        } else {
          status.class = "untouched";
        }
        break;
      case "race":
        if (choices.race) {
          status.race = "complete";
        } else {
          status.race = "untouched";
        }
        break;
      case "background":
        if (choices.background) {
          status.background = "complete";
        } else {
          status.background = "untouched";
        }
        break;
      case "abilities":
        if (
          choices.ability_method &&
          Object.keys(baseStats).length > 0
        ) {
          status.abilities = "complete";
        } else if (choices.ability_method) {
          status.abilities = "in_progress";
        } else {
          status.abilities = "untouched";
        }
        break;
      case "equipment":
        if (choices.starting_equipment) {
          status.equipment = "complete";
        } else {
          status.equipment = "untouched";
        }
        break;
      default:
        status[step.type] = "untouched";
    }
  }

  return status;
}

export default async function BuilderLayout({ children, params }: LayoutProps) {
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
  if (character.user_id !== user.id) notFound();

  const schema = character.game_systems?.schema_definition;
  const steps: CreationStep[] = schema?.creation_steps ?? [];
  const stepStatus = computeStepStatus(
    steps,
    character.choices ?? {},
    character.base_stats ?? {},
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{character.name}</h1>
          <p className="text-sm text-muted-foreground">Character Builder</p>
        </div>
        <Link href={`/characters/${id}`}>
          <Button variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <BuilderStepNav
        characterId={id}
        steps={steps}
        stepStatus={stepStatus}
      />

      {children}
    </div>
  );
}
