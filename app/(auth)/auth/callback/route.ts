import { createClient } from "@/lib/supabase/server";
import { isLinkableIdentityProvider } from "@/lib/auth/identity-providers";
import { NextResponse } from "next/server";

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
  const linkedProvider = isLinkableIdentityProvider(requestedProvider) ? requestedProvider : null;

  if (code) {
    const supabase = await createClient();
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        if (linkedProvider) {
          const { data, error: identitiesError } = await supabase.auth.getUserIdentities();
          const linked = !identitiesError
            && data.identities.some((identity) => identity.provider === linkedProvider);
          const destination = addQuery(next, linked ? "linked" : "linkError", linkedProvider);
          return NextResponse.redirect(`${origin}${destination}`);
        }

        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // Unexpected auth client failures use the same recovery redirects below.
    }
  }

  if (linkedProvider) {
    return NextResponse.redirect(`${origin}${addQuery(next, "linkError", linkedProvider)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
