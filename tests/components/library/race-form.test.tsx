import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { raceDataSchema } from "@/lib/schemas/content-types/race";
import { mapHomebrewRaceFormData } from "@/lib/homebrew/race-form";

const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/app/(app)/homebrew/races/actions", () => ({ createHomebrewRace: actions.create, updateHomebrewRace: actions.update }));
import { RaceForm } from "@/components/library/race-form";
const data = raceDataSchema.parse({ size: "Medium", speed: 40, speed_detail: { walk: 40 }, age_description: "Original age notes.",
  alignment_description: "Original alignment notes.", size_description: "Original size notes.", language_description: "Original language notes." });

describe("core RaceForm", () => {
  it("offers finite canonical controls without inventing size/speed or exposing unsupported mechanics", () => {
    render(<RaceForm mode="create" />);
    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Size")).toHaveValue("");
    expect(screen.getByLabelText("Walking speed (ft.)")).toBeRequired();
    expect(screen.getByLabelText("Walking speed (ft.)")).toHaveValue("");
    expect(screen.queryByLabelText(/scores|traits|subraces|grants|effects|owner|scope|annotation/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Language descriptions do not grant languages/)).toBeVisible();
  });
  it("does not submit walking controls for a read-only legacy record", () => {
    render(<RaceForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Aster Kin", version: 1, data: { ...data, speed_detail: { walk: 35 } }, walkingEditable: false }} />);
    expect(screen.getByLabelText("Walking speed (ft.)")).toBeDisabled();
    expect(screen.getByLabelText("Walking speed (ft.)")).not.toHaveAttribute("name");
    expect(screen.getByText(/Both remain unchanged/)).toBeVisible();
    expect(screen.getByText(/Walking speed is read-only/)).toBeVisible();
  });
  it("retains real submitted metadata and select values after settled action/native reset", async () => {
    actions.update.mockImplementation(async (_previous, submitted: FormData) => {
      expect(mapHomebrewRaceFormData(submitted, true)).toMatchObject({ success: true, data: { name: "Revised kin", walkingSpeed: 50,
        metadata: { size: "Small", age_description: "Revised age notes." } } });
      return { status: "error", message: "Validation failed.", fieldErrors: { speed: ["Simulated validation error."] } };
    });
    render(<RaceForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Aster Kin", version: 1, data, walkingEditable: true }} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Revised kin" } });
    fireEvent.change(screen.getByLabelText("Size"), { target: { value: "Small" } });
    fireEvent.change(screen.getByLabelText("Walking speed (ft.)"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Age description"), { target: { value: "Revised age notes." } });
    fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!);
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Name")).toHaveValue("Revised kin");
    expect(screen.getByLabelText("Size")).toHaveValue("Small");
    expect(screen.getByLabelText("Walking speed (ft.)")).toHaveValue("50");
    expect(screen.getByLabelText("Walking speed (ft.)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Age description")).toHaveValue("Revised age notes.");
    expect(screen.getByLabelText("Language description")).toHaveValue("Original language notes.");
  });
  it("disables stale resubmission and offers explicit reload", async () => {
    actions.update.mockResolvedValue({ status: "conflict", message: "Reload latest." });
    render(<RaceForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Aster Kin", version: 1, data, walkingEditable: true }} />);
    fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeEnabled();
  });
});
