import Link from "next/link";
import { Logo } from "@/components/landing/logo";

/**
 * Quiet manuscript footer — slim variant from the journey handoff
 * (JLandingFooter in journey-primitives.jsx).
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-border py-6">
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between">
        <Logo className="scale-90 opacity-80" />
        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Inkborne · Open source · A community project
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="https://discord.gg/inkborne"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-accent"
          >
            Discord
          </Link>
          <Link
            href="https://github.com/inkborne"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-accent"
          >
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
