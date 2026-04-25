import { createClient as createAdminClient } from "@supabase/supabase-js";

/** Where the error originated. Client-side sources use the auth'd client;
 *  server-side sources use the service-role client. */
export type ErrorSource =
  | "client_unhandled"
  | "client_rejection"
  | "client_boundary"
  | "server_action"
  | "server_route"
  | "manual";

export type ErrorStatus = "new" | "triaged" | "resolved" | "wontfix" | "duplicate";

export interface ErrorRow {
  id: string;
  user_id: string | null;
  source: ErrorSource;
  message: string;
  stack: string | null;
  page_url: string | null;
  user_agent: string | null;
  context: Record<string, unknown> | null;
  status: ErrorStatus;
  admin_notes: string | null;
  created_at: string;
}

/** Max characters stored per field. Protects against runaway payloads (minified
 *  bundles can produce very long stack traces and error messages). */
const MAX_MESSAGE_LEN = 5000;
const MAX_STACK_LEN = 10000;

/** Minimal Supabase client shape for the client-side reporter. Insert returns
 *  a PromiseLike thenable (Supabase builders are thenable, not strict Promises). */
interface SupabaseLike {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<{ error: unknown | null }>;
  };
}

/** Truncate long strings before insert to keep row sizes bounded. */
function truncate(value: string | undefined | null, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? value.slice(0, max) : value;
}

export interface ClientErrorInput {
  source: Extract<ErrorSource, "client_unhandled" | "client_rejection" | "client_boundary" | "manual">;
  message: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
  pageUrl?: string | null;
  userAgent?: string | null;
}

/**
 * Log a client-side error. Called from window listeners, React boundary,
 * and manual reporter calls. Best-effort: swallows its own failures so that
 * error reporting cannot itself produce a new visible error.
 *
 * Requires an auth'd Supabase client. RLS enforces user_id = auth.uid().
 */
export async function reportClientError(
  supabase: SupabaseLike,
  userId: string,
  input: ClientErrorInput,
): Promise<void> {
  if (!input.message?.trim()) return;
  try {
    await supabase.from("app_errors").insert({
      user_id: userId,
      source: input.source,
      message: truncate(input.message, MAX_MESSAGE_LEN) ?? "",
      stack: truncate(input.stack, MAX_STACK_LEN),
      page_url: input.pageUrl ?? null,
      user_agent: input.userAgent ?? null,
      context: input.context ?? null,
    });
  } catch {
    // Best-effort. Do not throw from the reporter itself.
  }
}

/** Create a service-role Supabase client for admin reads/updates + server-side
 *  error logging that needs to bypass RLS (e.g. NULL user_id for pre-auth errors). */
function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be configured");
  }
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface ServerErrorInput {
  source: Extract<ErrorSource, "server_action" | "server_route" | "manual">;
  message: string;
  stack?: string | null;
  userId?: string | null;
  pageUrl?: string | null;
  context?: Record<string, unknown> | null;
}

/**
 * Log a server-side error. Uses the service-role client so it works even when
 * there is no authenticated user (e.g., failures in the signup flow).
 * Best-effort: swallows its own failures.
 */
export async function reportServerError(input: ServerErrorInput): Promise<void> {
  if (!input.message?.trim()) return;
  try {
    const admin = createServiceRoleClient();
    await admin.from("app_errors").insert({
      user_id: input.userId ?? null,
      source: input.source,
      message: truncate(input.message, MAX_MESSAGE_LEN) ?? "",
      stack: truncate(input.stack, MAX_STACK_LEN),
      page_url: input.pageUrl ?? null,
      user_agent: null,
      context: input.context ?? null,
    });
  } catch {
    // Best-effort. Logging a logging failure is a dead end.
  }
}

/** List all error rows (admin only). Callers must gate with isAdminUserId. */
export async function listAllErrors(): Promise<ErrorRow[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("app_errors")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ErrorRow[];
}

/** Update status and/or admin notes (admin only). Callers must gate. */
export async function updateErrorStatus(
  id: string,
  patch: { status?: ErrorStatus; admin_notes?: string | null },
): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("app_errors").update(patch).eq("id", id);
  if (error) throw error;
}
