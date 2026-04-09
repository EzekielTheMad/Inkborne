import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CharacterDashboardPage({ params }: PageProps) {
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

  const hasSheet =
    character.choices?.classes && character.choices.classes.length > 0;

  const primaryClass = character.choices?.classes?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{character.name}</h1>
          <p className="text-muted-foreground">
            {character.game_systems?.name}
            {primaryClass && (
              <span>
                {" "}
                &middot; Level {character.level}{" "}
                <span className="capitalize">{primaryClass.slug}</span>
              </span>
            )}
          </p>
        </div>
        <Link href="/characters">
          <Button variant="outline" className="w-full sm:w-auto">Back to Characters</Button>
        </Link>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">Overview</TabsTrigger>
          <TabsTrigger value="narrative" className="flex-1 sm:flex-none">Narrative</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Open Character Sheet CTA */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">
                    {hasSheet ? "Ready to play?" : "Not built yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasSheet
                      ? "Open the full character sheet to track HP, conditions, and more."
                      : "Complete the builder to unlock the play-mode character sheet."}
                  </p>
                </div>
                <Link
                  href={
                    hasSheet
                      ? `/characters/${character.id}/sheet`
                      : `/characters/${character.id}/builder`
                  }
                >
                  <Button className="w-full sm:w-auto">
                    {hasSheet ? "Open Character Sheet" : "Build Character Sheet"}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Character Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {hasSheet ? (
                <div className="space-y-2">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Class</p>
                      <p className="font-medium capitalize">
                        {character.choices.classes
                          ?.map(
                            (c: { slug: string; level: number }) =>
                              `${c.slug} ${c.level}`,
                          )
                          .join(" / ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Race</p>
                      <p className="font-medium capitalize">
                        {character.choices.race ?? "Not selected"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Background</p>
                      <p className="font-medium capitalize">
                        {character.choices.background ?? "Not selected"}
                      </p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="grid gap-4 grid-cols-3 sm:grid-cols-6">
                    {Object.entries(character.base_stats || {}).map(
                      ([stat, value]) => (
                        <div key={stat} className="text-center">
                          <p className="text-xs text-muted-foreground uppercase">
                            {stat.slice(0, 3)}
                          </p>
                          <p className="text-2xl font-bold">{value as number}</p>
                          <p className="text-sm text-muted-foreground">
                            {Math.floor(((value as number) - 10) / 2) >= 0
                              ? "+"
                              : ""}
                            {Math.floor(((value as number) - 10) / 2)}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No character sheet yet. Build your character to see a
                    summary here.
                  </p>
                  <Link href={`/characters/${character.id}/builder`}>
                    <Button>Build Character Sheet</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="narrative" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Backstory</CardTitle>
              <CardDescription>
                A polished narrative editing experience is coming in a future
                update.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {character.choices?.personality_traits &&
                  character.choices.personality_traits.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Personality Traits
                      </p>
                      {character.choices.personality_traits.map(
                        (trait: string, i: number) => (
                          <p key={i} className="text-sm">
                            {trait}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {character.choices?.ideals &&
                  character.choices.ideals.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Ideals
                      </p>
                      {character.choices.ideals.map(
                        (ideal: string, i: number) => (
                          <p key={i} className="text-sm">
                            {ideal}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {character.choices?.bonds &&
                  character.choices.bonds.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Bonds
                      </p>
                      {character.choices.bonds.map(
                        (bond: string, i: number) => (
                          <p key={i} className="text-sm">
                            {bond}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {character.choices?.flaws &&
                  character.choices.flaws.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Flaws
                      </p>
                      {character.choices.flaws.map(
                        (flaw: string, i: number) => (
                          <p key={i} className="text-sm">
                            {flaw}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {!character.choices?.personality_traits?.length &&
                  !character.choices?.ideals?.length &&
                  !character.choices?.bonds?.length &&
                  !character.choices?.flaws?.length && (
                    <p className="text-sm text-muted-foreground italic">
                      No narrative details yet. Choose a background in the
                      builder to set personality traits, ideals, bonds, and
                      flaws.
                    </p>
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  );
}
