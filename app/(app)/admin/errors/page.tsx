import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/is-admin";
import { listAllErrors } from "@/lib/supabase/errors";
import { ErrorAdminClient } from "./error-admin-client";

/**
 * Hidden admin route: alpha error dashboard.
 *
 * Not linked from any nav. Access gated by `ADMIN_USER_IDS` env var. Non-admin
 * users (and unauthenticated users) get a 404.
 */
export default async function AdminErrorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminUserId(user.id)) notFound();

  const rows = await listAllErrors();

  return <ErrorAdminClient rows={rows} />;
}

export const dynamic = "force-dynamic";
