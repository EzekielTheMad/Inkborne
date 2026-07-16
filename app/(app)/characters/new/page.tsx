import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCharacter } from "@/app/(app)/characters/new/actions";
import { InkRule } from "@/components/journey/ornaments";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewCharacterPage({ searchParams }: PageProps) {
  const { error: pageError } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: systems } = await supabase
    .from("game_systems")
    .select("id, name, slug")
    .eq("status", "published")
    .order("name");

  const onlySystem = systems && systems.length === 1 ? systems[0] : null;

  return (
    <div className="mx-auto max-w-lg py-4 sm:py-8">
      <div className="j-card-paper p-6 sm:p-8">
        <p className="j-folio mb-2.5 text-center">Folio I · A first line</p>
        <h1 className="j-display text-center text-2xl text-foreground">
          Begin a new character
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-muted-foreground">
          {onlySystem
            ? `One name is enough to open a ${onlySystem.name} notebook.`
            : "Choose a name and game system to open the notebook."}
        </p>

        <InkRule className="my-5" />

        {pageError && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-destructive/35 bg-destructive/[0.06] px-3.5 py-3 text-[12.5px] text-[#f4a3a3]"
          >
            Error: {decodeURIComponent(pageError)}
          </p>
        )}

        <form action={createCharacter} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              What will they be called?
            </label>
            <Input
              id="name"
              name="name"
              placeholder="A name (you can change it later)"
              required
              autoFocus
            />
          </div>

          {onlySystem ? (
            <input type="hidden" name="system_id" value={onlySystem.id} />
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor="system_id"
                className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Game system
              </label>
              <select
                id="system_id"
                name="system_id"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a game system</option>
                {systems?.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button type="submit" variant="gold" className="w-full">
            Begin →
          </Button>
        </form>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
          Next you&rsquo;ll pick a race, class, abilities, background and starting equipment —
          about 8–12 minutes. You can rename or change your character at any time.
        </p>
      </div>
    </div>
  );
}
