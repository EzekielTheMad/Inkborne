import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/landing/logo", () => ({
  Logo: ({ linkTo }: { linkTo: string }) => <a href={linkTo}>Inkborne</a>,
}));
vi.mock("@/components/nav/nav-link", () => ({
  NavLink: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/feedback/feedback-button", () => ({
  FeedbackButton: () => <button type="button">Feedback</button>,
}));
vi.mock("@/components/nav/admin-button", () => ({
  AdminButton: () => <a href="/admin">Admin</a>,
}));
vi.mock("@/components/nav/user-dropdown", () => ({
  UserDropdown: () => <button type="button">Profile</button>,
}));

import { AppNav } from "@/components/nav/app-nav";

describe("AppNav", () => {
  it("keeps the encyclopedia and authoring workspace as separate destinations", () => {
    render(
      <AppNav
        displayName="Alpha Tester"
        avatarUrl={null}
        email="tester@example.com"
        isAdmin={false}
      />,
    );

    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    expect(screen.getByRole("link", { name: "Homebrew" })).toHaveAttribute("href", "/homebrew");
  });
});
