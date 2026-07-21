"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error: string | null;
};

export async function login(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
    return { error: "Enter your email and password." };
  }

  const email = rawEmail.trim();
  if (!email || !rawPassword) {
    return { error: "Enter your email and password." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: rawPassword,
    });

    if (error) {
      return { error: "Email or password was incorrect." };
    }
  } catch {
    return { error: "Unable to sign in. Please try again." };
  }

  redirect("/dashboard");
}
