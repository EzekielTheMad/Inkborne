import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileSection } from "@/components/settings/profile-section";
import { EmailSection } from "@/components/settings/email-section";
import { PasswordSection } from "@/components/settings/password-section";
import { ConnectedAccountsSection } from "@/components/settings/connected-accounts-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { DangerZoneSection } from "@/components/settings/danger-zone-section";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bio, preferences")
    .eq("id", user.id)
    .single();

  const hasPasswordIdentity = user.identities?.some(
    (identity) => identity.provider === "email"
  ) ?? false;

  const identities = (user.identities ?? []).map((identity) => ({
    id: identity.id,
    provider: identity.provider,
  }));

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

      <EmailSection email={user.email || ""} />

      <PasswordSection hasPasswordIdentity={hasPasswordIdentity} />

      <ConnectedAccountsSection identities={identities} />

      <AppearanceSection />

      <DangerZoneSection />
    </div>
  );
}
