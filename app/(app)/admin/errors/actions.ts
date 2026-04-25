"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/is-admin";
import { updateErrorStatus, type ErrorStatus } from "@/lib/supabase/errors";
import { revalidatePath } from "next/cache";

/**
 * Update an error row's status and/or admin notes. Gated by `isAdminUserId`
 * — non-admins get a silent no-op (the route is already inaccessible to them).
 */
export async function updateErrorAction(
  id: string,
  patch: { status?: ErrorStatus; admin_notes?: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUserId(user?.id)) {
    return { error: "Unauthorized" };
  }
  try {
    await updateErrorStatus(id, patch);
    revalidatePath("/admin/errors");
    return {};
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return { error: message };
  }
}
