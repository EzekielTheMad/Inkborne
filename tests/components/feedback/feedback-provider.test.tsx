import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedbackButton } from "@/components/feedback/feedback-button";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";

vi.mock("@/components/feedback/feedback-dialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Shared feedback form</div> : null,
}));

describe("FeedbackProvider", () => {
  it("shares one dialog across desktop and mobile header triggers", () => {
    render(
      <FeedbackProvider>
        <FeedbackButton />
        <FeedbackButton iconOnly />
      </FeedbackProvider>,
    );

    const triggers = screen.getAllByRole("button", { name: "Send feedback" });
    expect(triggers).toHaveLength(2);

    fireEvent.click(triggers[0]);

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveTextContent("Shared feedback form");
  });
});
