import { createClient as createAdminClient } from "@supabase/supabase-js";

/** Tags a user can attach to a feedback submission. */
export type FeedbackTag = "bug" | "feature" | "question" | "other";

/** Lifecycle state of a feedback item. Managed by admins. */
export type FeedbackStatus = "new" | "triaged" | "resolved" | "wontfix";

export interface FeedbackInput {
  tag?: FeedbackTag | null;
  text: string;
  pageUrl?: string | null;
  userAgent?: string | null;
}

export interface FeedbackRow {
  id: string;
  user_id: string;
  tag: FeedbackTag | null;
  text: string;
  page_url: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
}

/**
 * Minimal Supabase client shape so tests/callers can pass mocks. `insert`
 * is typed as PromiseLike because Supabase's `.insert()` returns a builder
 * that's thenable rather than a strict Promise.
 */
interface SupabaseLike {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<{ error: unknown | null }>;
  };
}

/**
 * Submit a feedback row as the currently-authenticated user. The caller must
 * pass a Supabase client with the user's session attached — RLS enforces
 * `user_id = auth.uid()` on insert.
 *
 * Returns an error message string on failure, or null on success.
 */
export async function submitFeedback(
  supabase: SupabaseLike,
  userId: string,
  input: FeedbackInput,
): Promise<string | null> {
  if (!input.text.trim()) return "Feedback text is required.";

  const { error } = await supabase.from("feedback").insert({
    user_id: userId,
    tag: input.tag ?? null,
    text: input.text.trim(),
    page_url: input.pageUrl ?? null,
    user_agent: input.userAgent ?? null,
  });

  if (error) {
    const message = (error as { message?: string }).message ?? "Failed to submit feedback.";
    return message;
  }
  return null;
}

/** Create a service-role Supabase client for admin-only reads/updates. Server-side only. */
function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be configured for admin operations");
  }
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * List all feedback rows (admin only). Bypasses RLS via the service-role key
 * — callers must gate this by `isAdminUserId` before calling.
 */
export async function listAllFeedback(): Promise<FeedbackRow[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FeedbackRow[];
}

/**
 * Update feedback status and/or admin notes (admin only). Bypasses RLS via
 * the service-role key — callers must gate this by `isAdminUserId`.
 */
export async function updateFeedbackStatus(
  id: string,
  patch: { status?: FeedbackStatus; admin_notes?: string | null },
): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("feedback").update(patch).eq("id", id);
  if (error) throw error;
}
