import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare, AlertTriangle, Users } from "lucide-react";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/is-admin";

/**
 * Admin hub page. Lists all admin sub-dashboards with quick stats. Gated by
 * `ADMIN_USER_IDS` env var — non-admins get 404 (indistinguishable from any
 * other unknown route).
 *
 * Sub-pages keep their own gating (they're independently reachable). This
 * hub is the entry point + at-a-glance.
 */
export default async function AdminHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminUserId(user.id)) notFound();

  const stats = await fetchStats();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Internal dashboards for monitoring alpha activity. Not linked from public nav.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/users"
          className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors space-y-2 block"
        >
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h2 className="font-semibold">Users</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Signups, last sign-in, and character counts.
          </p>
          <div className="flex items-center gap-3 pt-1 text-sm">
            <span>
              <span className="font-semibold">{stats.users.total}</span> total
            </span>
            {stats.users.recent > 0 && (
              <span className="text-primary">
                <span className="font-semibold">{stats.users.recent}</span> in last 7d
              </span>
            )}
          </div>
        </Link>

        <Link
          href="/admin/feedback"
          className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors space-y-2 block"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-accent" />
            <h2 className="font-semibold">Feedback</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            User-submitted feedback via the in-app widget.
          </p>
          <div className="flex items-center gap-3 pt-1 text-sm">
            <span>
              <span className="font-semibold">{stats.feedback.total}</span> total
            </span>
            {stats.feedback.new > 0 && (
              <span className="text-primary">
                <span className="font-semibold">{stats.feedback.new}</span> new
              </span>
            )}
          </div>
        </Link>

        <Link
          href="/admin/errors"
          className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors space-y-2 block"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h2 className="font-semibold">Errors</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Runtime exceptions captured client-side and from server actions.
          </p>
          <div className="flex items-center gap-3 pt-1 text-sm">
            <span>
              <span className="font-semibold">{stats.errors.total}</span> total
            </span>
            {stats.errors.new > 0 && (
              <span className="text-destructive">
                <span className="font-semibold">{stats.errors.new}</span> new
              </span>
            )}
          </div>
        </Link>
      </div>

      <div className="text-xs text-muted-foreground border-t border-border/50 pt-4">
        <p>
          More dashboards will appear here as they ship — content moderation,
          user management, system metrics. For now, feedback and errors are
          the two core surfaces.
        </p>
      </div>
    </div>
  );
}

interface AdminStats {
  users: { total: number; recent: number };
  feedback: { total: number; new: number };
  errors: { total: number; new: number };
}

/**
 * Fetch counts via service-role client (bypasses RLS — caller has already
 * verified admin status). Counts only; the dedicated sub-pages do the
 * full row reads.
 */
async function fetchStats(): Promise<AdminStats> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Without service-role key, skip stats — sub-pages will surface the issue.
    return {
      users: { total: 0, recent: 0 },
      feedback: { total: 0, new: 0 },
      errors: { total: 0, new: 0 },
    };
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [usersList, feedbackTotal, feedbackNew, errorsTotal, errorsNew] = await Promise.all([
    // listUsers returns paged data; we only need counts so default page (50) is fine
    // for alpha. If we ever exceed 50, page through. Using perPage=1000 to future-proof.
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("feedback").select("*", { count: "exact", head: true }),
    admin.from("feedback").select("*", { count: "exact", head: true }).eq("status", "new"),
    admin.from("app_errors").select("*", { count: "exact", head: true }),
    admin.from("app_errors").select("*", { count: "exact", head: true }).eq("status", "new"),
  ]);

  const allUsers = usersList.error ? [] : usersList.data.users;
  const recentUsers = allUsers.filter((u) => u.created_at && u.created_at >= sevenDaysAgo);

  return {
    users: {
      total: allUsers.length,
      recent: recentUsers.length,
    },
    feedback: {
      total: feedbackTotal.count ?? 0,
      new: feedbackNew.count ?? 0,
    },
    errors: {
      total: errorsTotal.count ?? 0,
      new: errorsNew.count ?? 0,
    },
  };
}

export const dynamic = "force-dynamic";
