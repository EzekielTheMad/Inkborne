import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileSection } from "@/components/settings/profile-section";
import { EmailSection } from "@/components/settings/email-section";
import { PasswordSection } from "@/components/settings/password-section";
import { ConnectedAccountsSection } from "@/components/settings/connected-accounts-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { DangerZoneSection } from "@/components/settings/danger-zone-section";
import { resolveIdentityLinkStatus } from "@/lib/auth/identity-providers";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    linked?: string | string[];
    linkError?: string | string[];
    signoutError?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const requestedLinkedProvider = typeof query.linked === "string" ? query.linked : null;
  const requestedLinkErrorProvider = typeof query.linkError === "string" ? query.linkError : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  console.log("[SettingsPage] Fetching profile for user:", user.id);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bio, preferences")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[SettingsPage] Error fetching profile:", profileError.message, profileError.details, profileError.hint);
  }

  let currentIdentities = user.identities ?? [];
  try {
    const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();
    if (!identitiesError) currentIdentities = identitiesData.identities;
  } catch {
    // Keep the authenticated user snapshot when the dedicated identity lookup rejects.
  }
  const { linkedProvider, linkErrorProvider } = resolveIdentityLinkStatus({
    requestedLinkedProvider,
    requestedLinkErrorProvider,
    currentProviders: currentIdentities.map((identity) => identity.provider),
  });

  const hasPasswordIdentity = currentIdentities.some(
    (identity) => identity.provider === "email"
  );

  const identities = currentIdentities.map((identity) => ({
    id: identity.id,
    identityId: identity.identity_id,
    userId: identity.user_id,
    provider: identity.provider,
  }));

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {query.signoutError === "1" && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          We couldn&apos;t sign you out. Your session may still be active; please try again.
        </p>
      )}

      <ProfileSection
        displayName={profile?.display_name || ""}
        avatarUrl={profile?.avatar_url || null}
        bio={profile?.bio || null}
      />

      <EmailSection email={user.email || ""} />

      <PasswordSection hasPasswordIdentity={hasPasswordIdentity} email={user.email || "your email"} />

      <ConnectedAccountsSection
        identities={identities}
        linkedProvider={linkedProvider}
        linkErrorProvider={linkErrorProvider}
        discordEnabled={process.env.NEXT_PUBLIC_DISCORD_AUTH_ENABLED === "true"}
      />

      <AppearanceSection />

      <DangerZoneSection />
    </div>
  );
}
