import Link from "next/link";
import { Shield } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Admin nav button. Renders only when the parent has determined the
 * current user is an admin (via `isAdminUserId`). Links to /admin (the
 * admin hub) — sub-pages live under /admin/feedback, /admin/errors, etc.
 */
export function AdminButton() {
  return (
    <Link
      href="/admin"
      aria-label="Admin dashboard"
      title="Admin dashboard"
      className={buttonVariants({ variant: "ghost", size: "sm" }) + " shrink-0"}
    >
      <Shield className="size-4" />
      <span className="ml-1.5">Admin</span>
    </Link>
  );
}
