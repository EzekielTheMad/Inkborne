import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-8">
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Inkborne. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="https://discord.gg/inkborne"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Discord
          </Link>
          <Link
            href="https://github.com/inkborne"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
