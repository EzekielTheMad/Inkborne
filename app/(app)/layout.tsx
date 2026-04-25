import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/nav/app-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import { ErrorListeners } from "@/components/error/error-listeners";
import { isAdminUserId } from "@/lib/auth/is-admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || "";
  const avatarUrl = profile?.avatar_url || null;
  const email = user.email || "";
  const isAdmin = isAdminUserId(user.id);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Global error + promise-rejection listeners (authenticated only). */}
      <ErrorListeners />
      <header className="border-b border-border">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <AppNav displayName={displayName} avatarUrl={avatarUrl} email={email} isAdmin={isAdmin} />
          <MobileNav displayName={displayName} avatarUrl={avatarUrl} email={email} isAdmin={isAdmin} />
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
