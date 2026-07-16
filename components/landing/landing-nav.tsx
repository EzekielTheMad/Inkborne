import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/landing/logo";

/**
 * Public landing chrome — alpha strip + nav, per the journey handoff
 * (JLandingNav in journey-primitives.jsx). Anchor links target the
 * landing page's own sections; external links stay in the footer.
 */
export function LandingNav() {
  return (
    <>
      <div className="border-b border-accent/20 bg-gradient-to-b from-accent/10 to-accent/[0.02] px-4 py-2 text-center text-xs tracking-wide text-accent">
        <span className="font-semibold">★ Alpha</span>
        <span className="ml-3 text-muted-foreground">
          Inkborne is in private alpha. Expect rough edges; characters made today are kept.
        </span>
      </div>
      <header className="border-b border-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="#features"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-accent sm:inline"
            >
              Features
            </a>
            <a
              href="#open-source"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-accent sm:inline"
            >
              Open source
            </a>
            <span className="hidden h-4 w-px bg-border-strong sm:inline-block" aria-hidden="true" />
            <Link
              href="/login"
              className="text-sm text-muted-foreground transition-colors hover:text-accent"
            >
              Sign in
            </Link>
            <Link href="/signup" className={buttonVariants({ variant: "gold" })}>
              Start building
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
