import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/landing/logo";

export function LandingNav() {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "default" })}>
            Create Account
          </Link>
        </div>
      </div>
    </header>
  );
}
