import { CharacterAppBrand, CharacterAppearance } from "@/components/nav/character-appearance";
import { NavLink } from "@/components/nav/nav-link";
import { UserDropdown } from "@/components/nav/user-dropdown";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { AdminButton } from "@/components/nav/admin-button";

interface AppNavProps {
  displayName: string;
  avatarUrl: string | null;
  email: string;
  isAdmin: boolean;
}

export function AppNav({ displayName, avatarUrl, email, isAdmin }: AppNavProps) {
  return (
    <>
      <div className="flex items-center gap-6">
        <CharacterAppBrand />
        <nav data-app-navigation className="hidden md:flex gap-4">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/characters">Characters</NavLink>
          <NavLink href="/campaigns">Campaigns</NavLink>
          <NavLink href="/library">Library</NavLink>
          <NavLink href="/homebrew">Homebrew</NavLink>
        </nav>
      </div>
      <div data-account-navigation className="hidden md:flex items-center gap-2">
        <CharacterAppearance />
        <FeedbackButton />
        {isAdmin && <AdminButton />}
        <UserDropdown displayName={displayName} avatarUrl={avatarUrl} email={email} />
      </div>
    </>
  );
}
