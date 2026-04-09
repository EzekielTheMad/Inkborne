import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNav />

      {/* Hero section */}
      <section className="relative flex flex-col items-center px-4 pt-20 pb-16 text-center md:pt-32 md:pb-24">
        {/* Background container — accepts background image via CSS later */}
        <div className="absolute inset-0 bg-background" aria-hidden="true" />

        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Character &amp; Campaign Management
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Your characters are{" "}
            <em className="not-italic text-accent">inkborne</em>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Build, manage, and bring your tabletop RPG characters to life.
            A modern toolkit for players and game masters who want more
            from their character sheets.
          </p>
          <Link href="/signup" className={buttonVariants({ size: "lg" }) + " mt-2"}>
            Start Building
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            D&amp;D 5e &nbsp;&middot;&nbsp; Dagger Heart &nbsp;&middot;&nbsp; More coming
          </p>
        </div>
      </section>

      {/* Product preview */}
      <section className="flex justify-center px-4 pb-20 md:pb-28">
        <div className="w-full max-w-4xl shadow-[0_0_60px_-15px] shadow-primary/20 rounded-lg">
          <Card className="overflow-hidden">
            <CardContent className="p-6 md:p-8">
              {/* Mock character header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Thalindra Moonweave</h3>
                  <p className="text-sm text-muted-foreground">Level 5 High Elf Wizard</p>
                </div>
                <Badge variant="secondary" className="text-accent border-accent/30">
                  Homebrew
                </Badge>
              </div>

              {/* Mock ability scores grid */}
              <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {[
                  { name: "STR", value: 8 },
                  { name: "DEX", value: 14 },
                  { name: "CON", value: 13 },
                  { name: "INT", value: 18 },
                  { name: "WIS", value: 12 },
                  { name: "CHA", value: 10 },
                ].map((stat) => (
                  <div
                    key={stat.name}
                    className="flex flex-col items-center rounded-md border border-border bg-secondary p-3"
                  >
                    <span className="text-xs font-medium text-muted-foreground">{stat.name}</span>
                    <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                    <span className="text-xs text-muted-foreground">
                      {stat.value >= 10 ? "+" : ""}{Math.floor((stat.value - 10) / 2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mock features list */}
              <div>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
                  Features
                </h4>
                <div className="space-y-2">
                  {[
                    "Arcane Recovery",
                    "Spell Mastery: Shield",
                    "Arcane Tradition: Chronurgy",
                    "Temporal Awareness",
                  ].map((feature) => (
                    <div
                      key={feature}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-t border-border bg-card py-16 md:py-20">
        <div className="container mx-auto grid gap-10 px-4 md:grid-cols-3 md:gap-8">
          {[
            {
              heading: "Open Source",
              description:
                "Transparent by default. See how it works, suggest improvements, build on top of it.",
            },
            {
              heading: "Built by Players",
              description:
                "We play the games we build for. Every feature solves a real problem at the table.",
            },
            {
              heading: "Join the Community",
              description:
                "Shape what gets built next. Your feedback drives the roadmap.",
            },
          ].map((item) => (
            <div key={item.heading} className="text-center md:text-left">
              <h3 className="mb-2 text-lg font-semibold text-foreground">{item.heading}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
