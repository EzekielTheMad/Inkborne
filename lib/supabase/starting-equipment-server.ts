import "server-only";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Only server code may construct this client. Never forward user cookies/JWT.
export function startingEquipmentEnabled() {
  return process.env.INKBORNE_ATOMIC_STARTING_EQUIPMENT === "true";
}
export function createStartingEquipmentClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Starting equipment is unavailable.");
  return createAdminClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
