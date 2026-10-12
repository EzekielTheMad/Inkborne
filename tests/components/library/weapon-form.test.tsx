import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { weaponDataSchema } from "@/lib/schemas/content-types/weapon";
import { mapHomebrewWeaponFormData } from "@/lib/homebrew/weapon-form";

const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/app/(app)/homebrew/weapons/actions", () => ({ createHomebrewWeapon: actions.create, updateHomebrewWeapon: actions.update }));
import { WeaponForm } from "@/components/library/weapon-form";

const data = weaponDataSchema.parse({ weapon_category: "Martial", weapon_range: "Melee", damage: { dice: "1d8", type: "slashing" },
  cost: { quantity: 0.0000001, unit: "gp" }, weight: 0.0000001, properties: ["versatile"], two_handed_damage: { dice: "1d10", type: "slashing" } });

describe("WeaponForm", () => {
  it("offers canonical finite fields without inventing damage or authoring extensions", () => {
    render(<WeaponForm mode="create" />);
    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Damage expression")).toHaveValue("");
    expect(screen.getByLabelText("Damage expression")).toBeRequired();
    expect(screen.getByLabelText("Weapon range")).toHaveValue("Melee");
    expect(screen.getByLabelText("Weapon category")).toHaveValue("Simple");
    expect(screen.getByLabelText("Cost quantity")).toHaveValue("");
    expect(screen.getByLabelText("versatile")).not.toBeChecked();
    expect(screen.queryByLabelText(/owner|scope|system|ability|monk|base weapon|source refs|effects/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Existing extensions and effects are preserved/)).toBeVisible();
  });

  it("round trips tiny weight and cost plus real edit controls through the mapper", async () => {
    actions.update.mockImplementation(async (_previous, submitted: FormData) => {
      expect(mapHomebrewWeaponFormData(submitted)).toMatchObject({ success: true, data: { data: { damage: { dice: "1d8", type: "slashing" },
        weight: 0.0000001, cost: { quantity: 0.0000001, unit: "gp" }, properties: ["versatile"] } } });
      return { status: "error", message: "Simulated failure after valid controls." };
    });
    render(<WeaponForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Oathblade", version: 2, data }} />);
    fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!);
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Weight (lb.)")).toHaveValue("1e-7");
    expect(screen.getByLabelText("Cost quantity")).toHaveValue("1e-7");
    expect(screen.getByLabelText("versatile")).toBeChecked();
    expect(screen.getByLabelText("Two-handed damage type")).toHaveValue("slashing");
  });

  it("retains the edited fields/properties after native reset and disables stale retries", async () => {
    actions.update.mockResolvedValue({ status: "conflict", message: "Reload latest.", fieldErrors: { range_normal: ["Stale range."] } });
    render(<WeaponForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Oathblade", version: 2, data }} />);
    fireEvent.change(screen.getByLabelText("Weapon range"), { target: { value: "Ranged" } });
    fireEvent.change(screen.getByLabelText("Normal range (ft.)"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Long range (ft.)"), { target: { value: "320" } });
    fireEvent.change(screen.getByLabelText("Damage expression"), { target: { value: "2d6" } });
    fireEvent.click(screen.getByLabelText("ammunition"));
    fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!);
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Weapon range")).toHaveValue("Ranged");
    expect(screen.getByLabelText("Normal range (ft.)")).toHaveValue("80");
    expect(screen.getByLabelText("Normal range (ft.)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Long range (ft.)")).toHaveValue("320");
    expect(screen.getByLabelText("Damage expression")).toHaveValue("2d6");
    expect(screen.getByLabelText("ammunition")).toBeChecked();
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeEnabled();
  });
});
