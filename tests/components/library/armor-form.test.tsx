import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { armorDataSchema } from "@/lib/schemas/content-types/armor";
import { mapHomebrewArmorFormData } from "@/lib/homebrew/armor-form";

const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/app/(app)/homebrew/armors/actions", () => ({ createHomebrewArmor: actions.create, updateHomebrewArmor: actions.update }));
import { ArmorForm } from "@/components/library/armor-form";
const data = armorDataSchema.parse({ armor_category: "Medium", armor_class: { base: 14, dex_bonus: true, max_bonus: 2 },
  cost: { quantity: 0.0000001, unit: "gp" }, weight: 0.0000001, str_minimum: 0, stealth_disadvantage: true });

describe("ArmorForm", () => {
  it("offers canonical fields and discloses the observed shield runtime limitation", () => {
    render(<ArmorForm mode="create" />);
    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Base armor class")).toBeRequired();
    expect(screen.getByLabelText("Base armor class")).toHaveValue("");
    expect(screen.getByLabelText("Maximum Dexterity bonus")).toHaveValue("");
    expect(screen.getByText(/do not automatically change movement or rolls/)).toBeVisible();
    expect(screen.queryByLabelText(/owner|scope|system|effects|metadata/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Armor category"), { target: { value: "Shield" } });
    expect(screen.getByText(/equipping a shield does not currently add this number to sheet AC/)).toBeVisible();
  });

  it("maps real edit controls and retains small cost/weight values after native reset", async () => {
    actions.update.mockImplementation(async (_previous, submitted: FormData) => {
      expect(mapHomebrewArmorFormData(submitted)).toMatchObject({ success: true, data: { data: { armor_class: { base: 14, dex_bonus: true, max_bonus: 2 },
        cost: { quantity: 0.0000001, unit: "gp" }, weight: 0.0000001, str_minimum: 0, stealth_disadvantage: true } } });
      return { status: "error", message: "Simulated save failure after valid mapping." };
    });
    render(<ArmorForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Courier mail", version: 2, data }} />);
    fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!);
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Armor category")).toHaveValue("Medium");
    expect(screen.getByLabelText("Cost quantity")).toHaveValue("1e-7");
    expect(screen.getByLabelText("Weight (lb.)")).toHaveValue("1e-7");
    expect(screen.getByLabelText("Add Dexterity modifier")).toBeChecked();
    expect(screen.getByLabelText("Stealth disadvantage")).toBeChecked();
  });

  it("keeps drafts and disables stale resubmission until explicit reload", async () => {
    actions.update.mockResolvedValue({ status: "conflict", message: "Reload latest.", fieldErrors: { armor_class_base: ["Stale armor class."] } });
    render(<ArmorForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Courier mail", version: 2, data }} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Revised mail" } });
    fireEvent.change(screen.getByLabelText("Base armor class"), { target: { value: "15" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!);
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Name")).toHaveValue("Revised mail");
    expect(screen.getByLabelText("Base armor class")).toHaveValue("15");
    expect(screen.getByLabelText("Base armor class")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeEnabled();
  });
});
