import { createClient } from "@/lib/supabase/server";
import { trustedRequestOrigin } from "@/lib/auth/site-url";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const origin = trustedRequestOrigin(request.headers);
  return NextResponse.redirect(new URL("/login", origin), { status: 303 });
}
