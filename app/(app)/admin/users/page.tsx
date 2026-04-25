import { notFound, redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/is-admin";
import { UsersAdminClient, type UserRow } from "./users-admin-client";

/**
 * /admin/users — alpha-pulse dashboard. Lists every signed-up user with
 * their signup date, last sign-in, and character counts. Sortable.
 *
 * Gated by `ADMIN_USER_IDS`. Non-admins get 404.
 */
export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminUserId(user.id)) notFound();

  const rows = await fetchUsers();
  return <UsersAdminClient rows={rows} />;
}

async function fetchUsers(): Promise<UserRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required for /admin/users");
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Three queries → JS-side join. For alpha-scale (≤100 users) this is plenty fast.
  // perPage 1000 is the practical max for listUsers; alpha won't approach it.
  const [usersResp, profilesResp, charactersResp] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id, display_name"),
    admin.from("characters").select("user_id, archived"),
  ]);

  if (usersResp.error) throw usersResp.error;
  if (profilesResp.error) throw profilesResp.error;
  if (charactersResp.error) throw charactersResp.error;

  const profilesById = new Map(
    (profilesResp.data ?? []).map((p) => [p.id as string, p]),
  );

  const charactersByUser = new Map<string, { active: number; archived: number }>();
  for (const row of charactersResp.data ?? []) {
    const userId = row.user_id as string;
    const counts = charactersByUser.get(userId) ?? { active: 0, archived: 0 };
    if (row.archived) counts.archived++;
    else counts.active++;
    charactersByUser.set(userId, counts);
  }

  return usersResp.data.users.map((u) => {
    const profile = profilesById.get(u.id);
    const counts = charactersByUser.get(u.id) ?? { active: 0, archived: 0 };
    return {
      id: u.id,
      email: u.email ?? "",
      display_name: (profile?.display_name as string | undefined) ?? "",
      signed_up_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      active_characters: counts.active,
      archived_characters: counts.archived,
    };
  });
}

export const dynamic = "force-dynamic";
