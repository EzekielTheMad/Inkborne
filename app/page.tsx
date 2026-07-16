import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Inkstain, StarRule, Quill } from "@/components/journey/ornaments";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

/**
 * Landing — journey variant B ("feature-forward"), the variant the
 * design handoff recommends. See docs/design-briefs/
 * design_handoff_journey_alpha/journey-landing-b.jsx.
 */
export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="j-grain flex min-h-screen flex-col overflow-hidden bg-background">
      <LandingNav />

      {/* Compressed hero */}
      <section className="relative px-4 pt-16 pb-12 text-center md:pt-20">
        <Inkstain className="left-1/2 top-8 h-[300px] w-[520px] -translate-x-1/2 opacity-5" />
        <div className="relative mx-auto max-w-3xl">
          <p className="j-folio mb-5">The sheet · The story · One place</p>
          <h1 className="j-display text-4xl leading-[1.1] text-foreground sm:text-5xl md:text-[56px]">
            Your character sheet
            <br />
            and your <em className="j-display-italic text-accent">character&rsquo;s story</em>,
            <br />
            in the same notebook.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Inkborne combines the dense character management of D&amp;D Beyond with
            the narrative depth of LegendKeeper — sheet, lore, sessions and secrets
            kept side by side.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ variant: "gold", size: "lg" }) + " px-6"}>
              Start building
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" }) + " px-6"}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Three differentiators */}
      <section id="features" className="px-4 pt-5 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <FeatureRow
            num="I"
            kicker="The sheet"
            title="Every modifier, computed. Every detail, in reach."
            body="A full character sheet that holds the math for you — stats, slots, resources, conditions, rests. Dense enough for a 20th-level paladin; calm enough to read across the table."
            visual={<SheetSnippet />}
          />
          <FeatureRow
            num="II"
            reverse
            kicker="The story"
            title="Sessions, NPCs, lore — beside the sheet, not in another tab."
            body="Your character's journal, the session you played last Thursday, the NPCs who owe you favors, the secrets you haven't told the party — all linked, all next to the stats they affect."
            visual={<NotebookSnippet />}
          />
          <FeatureRow
            num="III"
            kicker="One place, your way"
            title="Homebrew that flows through both."
            body="House rules, custom classes, signature items — defined once and valid in the sheet, the lore, and every character at your table. No syncing, no copy-paste, no contradictions."
            visual={<HomebrewSnippet />}
          />
        </div>
      </section>

      {/* Open-source moment */}
      <section
        id="open-source"
        className="relative mt-8 border-y border-border bg-paper-2 px-4 py-14 sm:px-8 md:py-16"
      >
        <Inkstain tone="purple" className="-right-20 top-5 h-[280px] w-[400px] opacity-5" />
        <div className="relative mx-auto grid max-w-3xl items-center gap-8 md:grid-cols-[auto_1fr] md:gap-9">
          <Quill className="mx-auto size-24 opacity-40 md:size-[120px]" />
          <div>
            <p className="j-folio mb-3">IV · Why open source matters here</p>
            <p className="j-pull">
              <span className="j-pull-mark">&ldquo;</span>
              The character sheet outlives the platform. Your notebook should not
              require our blessing — or our servers — to keep working.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span><span className="text-accent">★</span> Open source</span>
              <span><span className="text-accent">★</span> Self-hostable</span>
              <span><span className="text-accent">★</span> Built by players</span>
              <span><span className="text-accent">★</span> Your data, your rules</span>
            </div>
          </div>
        </div>
      </section>

      {/* Voices from the table */}
      <section className="px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-9 text-center">
            <StarRule />
            <h2 className="j-display mt-3.5 text-3xl text-foreground">From the table</h2>
            <p className="j-marginalia mt-1.5">Voices from our playtest group</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Quote
              name="DM, 12 years"
              body="Finally a sheet I can show on stream without it looking like a tax form."
            />
            <Quote
              name="Player, sorcadin enthusiast"
              body="Multiclass UI that doesn't make me cry. Set spell slots correctly the first time."
              gold
            />
            <Quote
              name="Forever-DM, homebrew shop"
              body="I made a custom class in an afternoon. The math just worked."
            />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-border bg-deep px-4 py-16 text-center md:py-20">
        <h2 className="j-display text-4xl text-foreground md:text-[42px]">Begin a character.</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          One name. One system. The rest is yours.
        </p>
        <Link
          href="/signup"
          className={buttonVariants({ variant: "gold", size: "lg" }) + " mt-7 px-8"}
        >
          Start building →
        </Link>
      </section>

      <LandingFooter />
    </div>
  );
}

/* ── Local sections ─────────────────────────────────────────────── */

function FeatureRow({
  num,
  kicker,
  title,
  body,
  reverse,
  visual,
}: {
  num: string;
  kicker: string;
  title: string;
  body: string;
  reverse?: boolean;
  visual: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-8 border-b border-border py-12 md:grid-cols-2 md:gap-14 md:py-14">
      <div className={reverse ? "md:order-2" : ""}>
        <div className="mb-3 flex items-baseline gap-3.5">
          <span className="j-display text-3xl text-accent opacity-50">{num}.</span>
          <span className="j-folio">{kicker}</span>
        </div>
        <h3 className="j-display text-2xl leading-tight text-foreground md:text-3xl">{title}</h3>
        <p className="mt-3.5 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className={reverse ? "md:order-1" : ""}>{visual}</div>
    </div>
  );
}

function SheetSnippet() {
  const saves: Array<[string, string, boolean]> = [
    ["STR", "−1", false],
    ["DEX", "+2", false],
    ["CON", "+1", false],
    ["INT", "+7", true],
    ["WIS", "+4", true],
    ["CHA", "+0", false],
  ];
  return (
    <div className="j-card-paper p-4 sm:p-5" aria-hidden="true">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        ★ Saving throws
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {saves.map(([name, value, gold]) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-md border border-border bg-white/[0.02] px-3 py-2 text-xs"
          >
            <span className="tracking-wider text-muted-foreground">{name}</span>
            <span className={`j-display text-sm ${gold ? "text-accent" : "text-foreground"}`}>
              {gold && <span className="mr-1">●</span>}
              {value}
            </span>
          </div>
        ))}
      </div>
      <p className="mb-2.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        ⚔ Defenses
      </p>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["AC", "17"],
          ["INIT", "+2"],
          ["SPD", "30"],
        ].map(([name, value]) => (
          <div
            key={name}
            className="rounded-md border border-border bg-white/[0.02] p-2.5 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {name}
            </p>
            <p className="j-display mt-0.5 text-[22px] text-foreground">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotebookSnippet() {
  return (
    <div className="j-card-paper p-5" aria-hidden="true">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="j-folio">Session XII</span>
        <span className="text-[11px] italic text-muted-foreground">Last waxing crescent</span>
      </div>
      <h4 className="j-display mb-2 text-lg text-foreground">The Tolling at Shadepoint</h4>
      <p className="text-[13px] leading-relaxed text-muted-foreground first-letter:float-left first-letter:mr-1.5 first-letter:font-display first-letter:text-[3.2em] first-letter:leading-[0.85] first-letter:text-accent">
        We arrived past second bell. The keeper would not look us in the eye, and yet he
        had set out three cups. Thalindra marked the page with iron filings — proof of
        recent abjuration — and slipped the keeper a coin he did not want to take.
      </p>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <LandingChip>★ The Keeper</LandingChip>
        <LandingChip purple>⚔ Combat: 2</LandingChip>
        <LandingChip>★ Iron filings</LandingChip>
      </div>
    </div>
  );
}

function HomebrewSnippet() {
  const features: Array<[string, string, string]> = [
    ["Lvl 1", "Evil Eye", "Curse a creature you can see (Prof. Mod / short rest)"],
    ["Lvl 1", "Familiar", "A toad, raven, or hare. Speaks one tongue you do not."],
    ["Lvl 3", "Coven Pact", "Choose your patronage — Hearth, Hollow, or Tide."],
  ];
  return (
    <div className="j-card-paper p-5" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="j-folio">House rules · The Coven of Greyfen</span>
        <span className="shrink-0 text-[10px] tracking-widest text-accent">● ACTIVE</span>
      </div>
      <h4 className="j-display mb-1 text-lg text-foreground">The Witch</h4>
      <p className="mb-3.5 text-xs italic text-muted-foreground">
        A custom class · CHA-based · Hit die d8
      </p>
      <div className="flex flex-col gap-1.5">
        {features.map(([lvl, name, desc]) => (
          <div
            key={name}
            className="grid grid-cols-[auto_auto_1fr] items-baseline gap-2.5 rounded-md border border-border bg-white/[0.015] px-3 py-2"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              {lvl}
            </span>
            <span className="text-xs font-semibold text-foreground">{name}</span>
            <span className="text-[11px] text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        ✦ &nbsp;Shared with 3 players at your table — math handled.
      </p>
    </div>
  );
}

function LandingChip({ children, purple }: { children: React.ReactNode; purple?: boolean }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] font-semibold uppercase tracking-wider ${
        purple
          ? "border-primary/40 bg-primary/10 text-[#b594ff]"
          : "border-accent/30 bg-accent/[0.08] text-accent"
      }`}
    >
      {children}
    </span>
  );
}

function Quote({ name, body, gold }: { name: string; body: string; gold?: boolean }) {
  return (
    <figure
      className={`relative rounded-[10px] border p-5 ${
        gold ? "border-accent/30 bg-accent/[0.04]" : "border-border bg-white/[0.015]"
      }`}
    >
      <span className="j-pull-mark absolute left-3.5 top-6" aria-hidden="true">
        &ldquo;
      </span>
      <blockquote className="j-display ml-6 mt-1 text-sm leading-relaxed text-foreground">
        {body}
      </blockquote>
      <figcaption className="ml-6 mt-3.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        — {name}
      </figcaption>
    </figure>
  );
}
