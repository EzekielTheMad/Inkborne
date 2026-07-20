"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { configuredSiteOrigin, trustedRequestOrigin } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

export type SignupActionState = {
  error: string | null;
};

export async function signup(
  _previousState: SignupActionState,
  formData: FormData,
): Promise<SignupActionState> {
  const rawDisplayName = formData.get("displayName");
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  if (
    typeof rawDisplayName !== "string" ||
    typeof rawEmail !== "string" ||
    typeof rawPassword !== "string"
  ) {
    return { error: "Complete every field to create your account." };
  }

  const displayName = rawDisplayName.trim();
  const email = rawEmail.trim();
  if (!displayName || !email || rawPassword.length < 8) {
    return { error: "Complete every field and use a password of at least 8 characters." };
  }

  try {
    const origin = configuredSiteOrigin() ?? trustedRequestOrigin(await headers());
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password: rawPassword,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      return { error: "Unable to create your account. Please check your details and try again." };
    }
  } catch {
    return { error: "Unable to create your account. Please try again." };
  }

  redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
}
