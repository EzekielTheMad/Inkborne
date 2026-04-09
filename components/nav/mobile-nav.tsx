"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavLink } from "@/components/nav/nav-link";
import { Menu } from "lucide-react";

interface MobileNavProps {
  displayName: string;
  avatarUrl: string | null;
  email: string;
}

export function MobileNav({ displayName, avatarUrl, email }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  function handleSignOut() {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-72 bg-card">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

          {/* User info */}
          <div className="flex items-center gap-3 mb-6 mt-2">
            <Avatar>
              <AvatarImage src={avatarUrl || undefined} alt={displayName || email} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{displayName || "User"}</span>
              <span className="text-xs text-muted-foreground">{email}</span>
            </div>
          </div>

          <Separator className="mb-4" />

          {/* Nav links */}
          <nav className="flex flex-col gap-3">
            <NavLink href="/dashboard" onClick={() => setOpen(false)} className="text-base">
              Dashboard
            </NavLink>
            <NavLink href="/characters" onClick={() => setOpen(false)} className="text-base">
              Characters
            </NavLink>
            <NavLink href="/campaigns" onClick={() => setOpen(false)} className="text-base">
              Campaigns
            </NavLink>
          </nav>

          <Separator className="my-4" />

          {/* Settings + Sign out */}
          <nav className="flex flex-col gap-3">
            <NavLink href="/settings" onClick={() => setOpen(false)} className="text-base">
              Settings
            </NavLink>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-base text-left text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
