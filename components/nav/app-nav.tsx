import { Logo } from "@/components/landing/logo";
import { NavLink } from "@/components/nav/nav-link";
import { UserDropdown } from "@/components/nav/user-dropdown";
import { FeedbackButton } from "@/components/feedback/feedback-button";

interface AppNavProps {
  displayName: string;
  avatarUrl: string | null;
  email: string;
}

export function AppNav({ displayName, avatarUrl, email }: AppNavProps) {
  return (
    <>
      <div className="flex items-center gap-6">
        <Logo linkTo="/dashboard" />
        <nav className="hidden md:flex gap-4">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/characters">Characters</NavLink>
          <NavLink href="/campaigns">Campaigns</NavLink>
        </nav>
      </div>
      <div className="hidden md:flex items-center gap-2">
        <FeedbackButton />
        <UserDropdown displayName={displayName} avatarUrl={avatarUrl} email={email} />
      </div>
    </>
  );
}
