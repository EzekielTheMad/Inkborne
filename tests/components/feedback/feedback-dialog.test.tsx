import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackDialog } from "@/components/feedback/feedback-dialog";

const { getUser, submitFeedback } = vi.hoisted(() => ({
  getUser: vi.fn(),
  submitFeedback: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/supabase/feedback", () => ({
  submitFeedback,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog" aria-label="Send Feedback">
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe("FeedbackDialog", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    submitFeedback.mockResolvedValue(null);
    window.history.pushState({}, "", "/characters/hero-1?tab=features");
  });

  it("submits the route and query where the feedback was written", async () => {
    render(<FeedbackDialog open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("What's on your mind?"), {
      target: { value: "The feature citation is hard to find." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith(
        expect.anything(),
        "user-1",
        expect.objectContaining({
          text: "The feature citation is hard to find.",
          pageUrl: "/characters/hero-1?tab=features",
        }),
      );
    });
  });
});
