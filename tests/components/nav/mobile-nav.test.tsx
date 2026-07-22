import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileNav } from "@/components/nav/mobile-nav";

vi.mock("@/components/feedback/feedback-dialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Feedback form</div> : null,
}));

describe("MobileNav", () => {
  it("offers feedback directly from the mobile header", () => {
    render(
      <MobileNav
        displayName="Alpha Tester"
        avatarUrl={null}
        email="tester@example.com"
        isAdmin={false}
      />,
    );

    const feedbackButton = screen.getByRole("button", { name: "Send feedback" });
    expect(feedbackButton).toBeVisible();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeVisible();

    fireEvent.click(feedbackButton);

    expect(screen.getByRole("dialog", { name: "" })).toHaveTextContent("Feedback form");
  });
});
