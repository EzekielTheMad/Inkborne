import { createClient } from "@/lib/supabase/server";
import { trustedRequestOrigin } from "@/lib/auth/site-url";
import { NextResponse } from "next/server";

const SEE_OTHER = 303;

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const origin = trustedRequestOrigin(request.headers);

  // A temporary 307 would replay this POST against /login, which only renders
  // for GET requests. A 303 explicitly turns the follow-up navigation into GET.
  return NextResponse.redirect(new URL("/login", origin), SEE_OTHER);
}
