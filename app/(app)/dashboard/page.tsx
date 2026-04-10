import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PortraitAvatar } from "@/components/narrative/portrait-avatar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .single();

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, level, choices, narrative, system_id, game_systems(name)")
    .eq("user_id", user!.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Your characters and campaigns.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Characters</CardTitle>
            <Link href="/characters">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {characters && characters.length > 0 ? (
              <div className="space-y-3">
                {characters.map((character) => {
                  const classes = (character.choices as Record<string, unknown>)?.classes as Array<{ slug: string; level: number }> | undefined;
                  const classDisplay = classes?.map((c) => `${c.slug} ${c.level}`).join(" / ");
                  const narrative = character.narrative as Record<string, unknown> | null;
                  const portraitUrl = narrative?.portrait_url as string | undefined;
                  const systemArr = character.game_systems as unknown as { name: string }[] | { name: string } | null;
                  const system = Array.isArray(systemArr) ? systemArr[0] : systemArr;

                  return (
                    <Link
                      key={character.id}
                      href={`/characters/${character.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <PortraitAvatar
                        portraitUrl={portraitUrl}
                        characterName={character.name}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {character.name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {classDisplay ? `Level ${character.level} ${classDisplay}` : "Not built yet"}
                          {system ? ` · ${system.name}` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
                <Link href="/characters/new">
                  <Button variant="outline" className="w-full mt-2">
                    Create New Character
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-4">
                  No characters yet. Create your first character to get started.
                </p>
                <Link href="/characters/new">
                  <Button>Create Character</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">
                Campaign management is coming soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
