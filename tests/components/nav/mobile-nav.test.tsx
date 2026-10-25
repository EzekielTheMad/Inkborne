import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileNav } from "@/components/nav/mobile-nav";
import { ThemeProvider } from "@/components/theme-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/components/feedback/feedback-dialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Feedback form</div> : null,
}));

describe("MobileNav", () => {
  it("keeps Library and Homebrew as separate destinations", () => {
    render(
      <ThemeProvider><MobileNav
        displayName="Alpha Tester"
        avatarUrl={null}
        email="tester@example.com"
        isAdmin={false}
      /></ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    expect(screen.getByRole("link", { name: "Homebrew" })).toHaveAttribute("href", "/homebrew");
  });

  it("offers feedback directly from the mobile header", () => {
    render(
      <ThemeProvider><MobileNav
        displayName="Alpha Tester"
        avatarUrl={null}
        email="tester@example.com"
        isAdmin={false}
      /></ThemeProvider>,
    );

    const feedbackButton = screen.getByRole("button", { name: "Send feedback" });
    expect(feedbackButton).toBeVisible();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeVisible();

    fireEvent.click(feedbackButton);

    expect(screen.getByRole("dialog", { name: "" })).toHaveTextContent("Feedback form");
  });
});
