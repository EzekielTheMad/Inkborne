import { createClient } from "@/lib/supabase/server";
import { trustedRequestOrigin } from "@/lib/auth/site-url";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const origin = trustedRequestOrigin(request.headers);
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch {
    return NextResponse.redirect(new URL("/settings?signoutError=1", origin), { status: 303 });
  }

  return NextResponse.redirect(new URL("/login", origin), { status: 303 });
}
