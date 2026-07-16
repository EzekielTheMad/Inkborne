import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { CharacterCard } from "@/components/characters/character-card";
import { Inkstain } from "@/components/journey/ornaments";

export default async function CharactersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: characters, error: charactersError } = await supabase
    .from("characters")
    .select("*, game_systems (name), campaigns (name)")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (charactersError) {
    console.error(
      "[CharactersPage] Error fetching characters:",
      charactersError.message,
      charactersError.details,
      charactersError.hint,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">The shelf</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">Characters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every notebook you keep, across all game systems.
          </p>
        </div>
        <Link
          href="/characters/new"
          className={buttonVariants({ variant: "gold" }) + " w-full sm:w-auto"}
        >
          + Begin a new character
        </Link>
      </div>

      {characters && characters.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-dashed border-border p-10 text-center sm:p-14">
          <Inkstain className="left-1/2 top-4 h-[240px] w-[380px] -translate-x-1/2 opacity-5" />
          <div className="relative">
            <p className="j-folio mb-3">A blank shelf</p>
            <h2 className="j-display text-xl text-foreground sm:text-2xl">No characters yet.</h2>
            <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Begin with a name, then walk through race, class, abilities, background and
              equipment. Most players finish in 8–12 minutes.
            </p>
            <Link
              href="/characters/new"
              className={buttonVariants({ variant: "gold" }) + " mt-6"}
            >
              Begin a character →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
