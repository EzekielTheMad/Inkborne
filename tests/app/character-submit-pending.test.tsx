import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CharacterSubmitButton } from "@/app/(app)/characters/new/submit-button";

describe("character creation pending submission", () => {
  it("announces real form pending state and prevents another submit-button click", async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<form action={action}><CharacterSubmitButton disabled={false} /></form>);
    fireEvent.click(screen.getByRole("button", { name: /begin/i }));
    const pending = await screen.findByRole("button", { name: "Creating character…" });
    expect(pending).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Please wait");
    fireEvent.click(pending);
    expect(action).toHaveBeenCalledOnce();
    await act(async () => finish());
    await waitFor(() => expect(screen.getByRole("button", { name: /begin/i })).toBeEnabled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("preserves the unavailable-system guard when the form is idle", () => {
    const action = vi.fn();
    render(<form action={action}><CharacterSubmitButton disabled={true} /></form>);
    fireEvent.click(screen.getByRole("button", { name: /begin/i }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /begin/i })).toBeDisabled();
  });
});
