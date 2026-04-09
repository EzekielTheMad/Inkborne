import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileSection } from "@/components/settings/profile-section";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bio, preferences")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <ProfileSection
        displayName={profile?.display_name || ""}
        avatarUrl={profile?.avatar_url || null}
        bio={profile?.bio || null}
      />

      {/* Email, Password, Connected Accounts, Appearance, and Danger Zone sections added in Tasks 15-16 */}
    </div>
  );
}
