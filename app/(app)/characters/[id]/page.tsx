import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { NarrativeTab } from "@/components/narrative/narrative-tab";
import { PortraitAvatar } from "@/components/narrative/portrait-avatar";

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

  console.log("[CharacterDashboardPage] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[CharacterDashboardPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character) notFound();

  const isOwner = character.user_id === user.id;

  // Determine if current user is DM of the campaign this character belongs to
  let isDm = false;
  if (character.campaign_id) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", character.campaign_id)
      .single();
    if (campaign) {
      isDm = campaign.owner_id === user.id;
    }
  }

  const hasSheet =
    character.choices?.classes && character.choices.classes.length > 0;

  const primaryClass = character.choices?.classes?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <PortraitAvatar
            portraitUrl={character.narrative?.portrait_url}
            characterName={character.name}
            size="lg"
          />
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

        <TabsContent value="narrative" className="mt-4">
          <NarrativeTab
            character={character}
            campaignId={character.campaign_id}
            isOwner={isOwner}
            isDm={isDm}
          />
        </TabsContent>


      </Tabs>
    </div>
  );
}
