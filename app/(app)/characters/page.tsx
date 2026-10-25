import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { CharacterCard } from "@/components/characters/character-card";
import { Inkstain, InkRule } from "@/components/journey/ornaments";
import styles from "@/components/characters/notebook-overview.module.css";

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
    <div className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className="j-folio">The shelf</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">Characters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every notebook you keep, across all game systems.
          </p>
        </div>
        <Link
          href="/characters/new"
          className={buttonVariants({ variant: "gold" }) + " " + styles.action}
        >
          + Begin a new character
        </Link>
      </div>

      <InkRule />

      {charactersError ? (
        <section role="alert">
          <h2>Your characters couldn&rsquo;t be loaded.</h2>
          <p>Refresh this page to try again.</p>
        </section>
      ) : characters && characters.length > 0 ? (
        <div className={styles.grid}>
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      ) : (
        <div className={`${styles.empty} relative border border-dashed border-border p-10 text-center sm:p-14`}>
          <Inkstain className="left-1/2 top-4 h-[240px] w-[380px] -translate-x-1/2 opacity-5" />
          <div className="relative">
            <p className="j-folio mb-3">A blank shelf</p>
            <h2 className="j-display text-xl text-foreground sm:text-2xl">No characters yet.</h2>
            <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Begin with a name, then walk through race, class, abilities, background and
              equipment. There&rsquo;s room for the story as you go.
            </p>
            <Link
              href="/characters/new"
              className={buttonVariants({ variant: "gold" }) + " " + styles.action}
            >
              Begin a character →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
