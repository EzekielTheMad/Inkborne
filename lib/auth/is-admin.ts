// Admin identification for the hidden /admin routes (feedback dashboard, etc.).
//
// Admins are configured via the ADMIN_USER_IDS env var as a comma-separated
// list of Supabase auth user UUIDs. Missing/empty env var = no admins.
//
// Why env var instead of an `is_admin` column on profiles:
//  - Alpha is friends-only, admin set is stable and small (2 today)
//  - No migration / admin bootstrap flow needed
//  - Trivial to audit — one env var controls who has admin access
//  - Easy to revoke (change env var, redeploy)
//
// When the admin set grows or needs self-service management, migrate to a
// profiles column. Until then, this is the simpler path.

/** Parse ADMIN_USER_IDS from env into a Set of UUIDs. */
function getAdminUserIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
}

/** Check whether the given user ID is configured as an admin. */
export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminUserIds().has(userId);
}
