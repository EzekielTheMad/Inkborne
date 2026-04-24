import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/is-admin";
import { listAllFeedback } from "@/lib/supabase/feedback";
import { FeedbackAdminClient } from "./feedback-admin-client";

/**
 * Hidden admin route: alpha feedback dashboard.
 *
 * Not linked from any nav. Access gated by `ADMIN_USER_IDS` env var. Non-admin
 * users (and unauthenticated users) get a 404 — indistinguishable from any
 * other unknown route, so the existence of the page isn't leaked.
 */
export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminUserId(user.id)) notFound();

  const rows = await listAllFeedback();

  return <FeedbackAdminClient rows={rows} />;
}

// No caching: feedback list should always be fresh for the admin.
export const dynamic = "force-dynamic";
