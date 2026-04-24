"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/is-admin";
import { updateFeedbackStatus, type FeedbackStatus } from "@/lib/supabase/feedback";
import { revalidatePath } from "next/cache";

/**
 * Update a feedback row's status and/or admin notes. Gated by
 * `isAdminUserId` — non-admins get a silent no-op (the route should
 * already be inaccessible to them).
 */
export async function updateFeedbackAction(
  id: string,
  patch: { status?: FeedbackStatus; admin_notes?: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUserId(user?.id)) {
    return { error: "Unauthorized" };
  }
  try {
    await updateFeedbackStatus(id, patch);
    revalidatePath("/admin/feedback");
    return {};
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return { error: message };
  }
}
