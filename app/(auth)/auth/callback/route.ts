import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const LINK_PROVIDERS = new Set(["discord", "google"]);

function safePath(value: string | null, fallback: string): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function addQuery(path: string, key: string, value: string): string {
  const url = new URL(path, "http://inkborne.local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = type === "recovery"
    ? "/auth/reset-password"
    : safePath(searchParams.get("next"), "/dashboard");
  const requestedProvider = searchParams.get("linked");
  const linkedProvider = requestedProvider && LINK_PROVIDERS.has(requestedProvider)
    ? requestedProvider
    : null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = linkedProvider ? addQuery(next, "linked", linkedProvider) : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  if (linkedProvider) {
    return NextResponse.redirect(`${origin}${addQuery(next, "linkError", linkedProvider)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
