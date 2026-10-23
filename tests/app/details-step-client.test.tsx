import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailsStepClient } from "@/app/(app)/characters/[id]/builder/details/details-step-client";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
describe("character builder details", () => {
  it("confirms a finite name/alignment patch before allowing completion", async () => {
    const save = vi.fn().mockResolvedValue({ choices: { alignment: "Neutral Good", details_confirmed: true }, scores: {} });
    render(<DetailsStepClient characterId="target" name="Mira" alignment="" confirmed={false} saveAction={save} />);
    expect(screen.getByRole("button", { name: "Review & Finish" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Character name"), { target: { value: "  Mira Reed  " } });
    fireEvent.change(screen.getByLabelText("Alignment"), { target: { value: "Neutral Good" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save details" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Review & Finish" })).toBeEnabled());
    expect(save).toHaveBeenCalledWith("save_details", { name: "Mira Reed", alignment: "Neutral Good" });
    expect(screen.getByLabelText("Character name")).toHaveValue("Mira Reed");
  });
});
