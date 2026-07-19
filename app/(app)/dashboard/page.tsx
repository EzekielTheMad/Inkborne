import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PortraitAvatar } from "@/components/narrative/portrait-avatar";
import { AlphaBanner } from "@/components/alpha/alpha-banner";
import { CharacterRow, formatClassLine } from "@/components/characters/character-row";
import { Inkstain, InkRule } from "@/components/journey/ornaments";
import type { CharacterChoices } from "@/lib/types/character";
import type { CropArea } from "@/components/narrative/portrait-avatar";

interface DashboardCharacter {
  id: string;
  name: string;
  level: number;
  choices: CharacterChoices | null;
  narrative: Record<string, unknown> | null;
  system_id: string;
  game_systems: { name: string }[] | { name: string } | null;
}

function systemName(character: DashboardCharacter): string | null {
  const sys = character.game_systems;
  if (!sys) return null;
  return Array.isArray(sys) ? (sys[0]?.name ?? null) : sys.name;
}

function portraitOf(character: DashboardCharacter): {
  url?: string;
  crop?: CropArea | null;
} {
  const narrative = character.narrative;
  return {
    url: narrative?.portrait_url as string | undefined,
    crop: (narrative?.portrait_crop as CropArea | undefined) ?? null,
  };
}

function subtitleOf(character: DashboardCharacter): string {
  const classLine = formatClassLine(character.choices);
  const system = systemName(character);
  return [classLine ?? "Not built yet", system].filter(Boolean).join(" · ");
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, preferences")
    .eq("id", user!.id)
    .single();

  const prefs = (profile?.preferences as Record<string, unknown> | null) ?? {};
  const alphaBannerDismissed = typeof prefs.alpha_banner_dismissed_at === "string";
  const displayName = profile?.display_name || null;

  const { data } = await supabase
    .from("characters")
    .select("id, name, level, choices, narrative, system_id, game_systems(name)")
    .eq("user_id", user!.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(8);

  const characters = (data ?? []) as unknown as DashboardCharacter[];
  const [latest, ...rest] = characters;

  /* ── Empty state: a blank notebook ─────────────────────────── */
  if (characters.length === 0) {
    return (
      <div className="space-y-6">
        {!alphaBannerDismissed && <AlphaBanner />}
        <section className="relative mx-auto max-w-2xl px-2 py-10 text-center sm:py-14">
          <Inkstain className="left-1/2 top-10 h-[340px] w-[500px] -translate-x-1/2 opacity-5" />
          <div className="relative">
            <p className="j-folio mb-3">Folio I · A blank notebook</p>
            <h1 className="j-display text-3xl text-foreground sm:text-4xl">
              Welcome
              {displayName ? (
                <>
                  , <em className="j-display-italic text-accent">{displayName}</em>
                </>
              ) : null}
              .
            </h1>
            <p className="mx-auto mt-3.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Your notebook is open. Nothing has been written yet — and that&rsquo;s the most
              exciting part.
            </p>

            <div className="j-card-paper mt-8 p-5 text-left sm:p-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                ★ Begin a character — what to expect
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {["I · Race", "II · Class", "III · Abilities", "IV · Background", "V · Equipment"].map(
                  (step, i) => (
                    <div
                      key={step}
                      className={`rounded-md border border-border px-2 py-2.5 text-center ${
                        i === 0 ? "bg-accent/5" : ""
                      }`}
                    >
                      <span
                        className={`j-display text-[13px] ${i === 0 ? "text-accent" : "text-foreground"}`}
                      >
                        {step}
                      </span>
                    </div>
                  ),
                )}
              </div>
              <p className="mb-0 mt-3.5 text-[11.5px] italic text-muted-foreground">
                Most players finish in 8–12 minutes. You can save and come back.
              </p>
            </div>

            <Link
              href="/characters/new"
              className={buttonVariants({ variant: "gold", size: "lg" }) + " mt-6 px-7"}
            >
              Begin a character →
            </Link>
          </div>
        </section>
      </div>
    );
  }

  /* ── Home base ──────────────────────────────────────────────── */
  const latestPortrait = portraitOf(latest);

  return (
    <div className="space-y-6">
      {!alphaBannerDismissed && <AlphaBanner />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Home</p>
          <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-[32px]">
            Welcome back
            {displayName ? (
              <>
                , <em className="j-display-italic text-accent">{displayName}</em>
              </>
            ) : null}
            .
          </h1>
        </div>
        <Link
          href="/characters/new"
          className={buttonVariants({ variant: "gold" }) + " w-full sm:w-auto"}
        >
          + Begin a new character
        </Link>
      </div>

      <InkRule />

      {/* Pick up where you left */}
      <section
        aria-label="Pick up where you left"
        className="j-card-paper relative overflow-hidden p-5 sm:p-6"
      >
        <Inkstain className="-right-10 -top-5 h-[200px] w-[300px] opacity-5" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <PortraitAvatar
            portraitUrl={latestPortrait.url}
            cropArea={latestPortrait.crop}
            characterName={latest.name}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="j-folio">Pick up where you left</p>
            <h2 className="j-display mt-1 truncate text-[22px] text-foreground">{latest.name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitleOf(latest)}</p>
          </div>
          <Link
            href={`/characters/${latest.id}`}
            className={
              buttonVariants({ variant: "gold", size: "sm" }) + " shrink-0 self-start sm:self-center"
            }
          >
            Open →
          </Link>
        </div>
      </section>

      {/* Characters list */}
      <section aria-label="Your characters">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            ★ Your characters
          </h2>
          <Link
            href="/characters"
            className="text-xs text-muted-foreground transition-colors hover:text-accent"
          >
            View all →
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {rest.map((character) => {
            const portrait = portraitOf(character);
            const built = (character.choices?.classes?.length ?? 0) > 0;
            return (
              <CharacterRow
                key={character.id}
                href={`/characters/${character.id}`}
                name={character.name}
                level={built ? character.level : null}
                subtitle={subtitleOf(character)}
                portraitUrl={portrait.url}
                cropArea={portrait.crop}
              />
            );
          })}
          {rest.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs italic text-muted-foreground">
              One notebook so far — the shelf has room for more.
            </p>
          )}
        </div>
      </section>

      {/* Campaigns strip */}
      <section
        aria-label="Campaigns"
        className="flex flex-col gap-2 rounded-lg border border-border bg-paper-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Shared worlds
          </p>
          <p className="text-[13px] text-muted-foreground">
            Campaigns — characters, lore, and secrets in one chronicle.
          </p>
        </div>
        <Link
          href="/campaigns"
          className="text-xs text-accent transition-colors hover:text-accent/80"
        >
          Open campaigns →
        </Link>
      </section>
    </div>
  );
}
