import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CharacterCard } from "@/components/characters/character-card";

export default async function CharactersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: characters } = await supabase
    .from("characters")
    .select("*, game_systems (name), campaigns (name)")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Characters</h1>
          <p className="text-muted-foreground mt-1">
            Manage your characters across all game systems.
          </p>
        </div>
        <Link href="/characters/new">
          <Button>Create New Character</Button>
        </Link>
      </div>

      {characters && characters.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-xl font-semibold mb-2">No characters yet</h2>
          <p className="text-muted-foreground mb-4">
            Create your first character to get started.
          </p>
          <Link href="/characters/new">
            <Button>Create New Character</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
