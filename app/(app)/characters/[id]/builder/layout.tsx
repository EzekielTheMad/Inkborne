import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BuilderStepNav } from "@/components/builder/builder-step-nav";
import { characterColorStyle } from "@/lib/character/character-color-style";
import { getBuilderStepStatus } from "@/lib/builder/step-status";
import type { CreationStep } from "@/lib/types/system";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function BuilderLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[BuilderLayout] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[BuilderLayout] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character) notFound();
  if (character.user_id !== user.id) notFound();

  const schema = character.game_systems?.schema_definition;
  const steps: CreationStep[] = schema?.creation_steps ?? [];
  const stepStatus = Object.fromEntries(
    steps.map((step) => [step.type, getBuilderStepStatus(
      step.type, character.choices ?? {}, character.base_stats ?? {},
    )]),
  );

  return (
    <div style={characterColorStyle(character.primary_color ?? null)}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">{character.name}</h1>
            <p className="text-sm text-muted-foreground">Character Builder</p>
          </div>
          <Link href={`/characters/${id}`}>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              View Character
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
    </div>
  );
}
