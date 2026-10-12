import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/app/(app)/homebrew/items/actions", () => ({ createHomebrewItem: actions.create, updateHomebrewItem: actions.update }));
import { ItemForm } from "@/components/library/item-form";
import { mapHomebrewItemFormData } from "@/lib/homebrew/item-form";

describe("ItemForm", () => {
  it("resubmits accepted small weight and cost unchanged from the edit form", async () => {
    actions.update.mockImplementation(async (_previous, submitted: FormData) => {
      const mapped = mapHomebrewItemFormData(submitted);
      expect(mapped).toMatchObject({ success: true, data: { data: { weight: 0.0000001, cost: { quantity: 0.0000001, unit: "gp" } } } });
      return { status: "error", message: "Simulated persistence failure after successful validation." };
    });
    render(<ItemForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Lantern", version: 2,
      data: { equipment_category: "Gear", description: "Travel lantern.", cost: { quantity: 0.0000001, unit: "gp" }, weight: 0.0000001 } }} />);
    expect(screen.getByLabelText("Cost quantity")).toHaveValue("1e-7");
    expect(screen.getByLabelText("Weight (lb.)")).toHaveValue("1e-7");
    fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!);
    await screen.findByRole("alert");
    const submitted = actions.update.mock.calls.at(-1)![1] as FormData;
    expect(mapHomebrewItemFormData(submitted)).toMatchObject({ success: true, data: { data: { weight: 0.0000001, cost: { quantity: 0.0000001 } } } });
  });

  it("offers finite ordinary equipment controls with optional cost and weight", () => {
    render(<ItemForm mode="create" />);
    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Equipment category")).toHaveValue("");
    expect(screen.getByLabelText("Cost quantity")).toHaveValue("");
    expect(screen.getByLabelText("Cost unit")).toHaveValue("");
    expect(screen.getByLabelText("Weight (lb.)")).toHaveValue("");
    expect(screen.getByLabelText("Item description")).not.toBeRequired();
    expect(screen.queryByLabelText(/effects|owner|scope|system|rarity|attunement/i)).not.toBeInTheDocument();
  });

  it("keeps every draft field after React settles an unsuccessful action", async () => {
    actions.create.mockResolvedValue({ status: "error", message: "Check fields.", fieldErrors: { cost_quantity: ["Invalid cost."] } });
    render(<ItemForm mode="create" />);
    for (const [label, value] of [["Name", "Folding Lantern"], ["Equipment category", "Adventuring Gear"],
      ["Cost quantity", "2.5"], ["Cost unit", "gp"], ["Weight (lb.)", "1.25"], ["Item description", "Travel lantern."]]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.submit(screen.getByRole("button", { name: "Create private item" }).closest("form")!);
    await screen.findByRole("alert");
    await waitFor(() => expect(actions.create).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Cost quantity")).toHaveValue("2.5");
    expect(screen.getByLabelText("Cost quantity")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Cost unit")).toHaveValue("gp");
    expect(screen.getByLabelText("Weight (lb.)")).toHaveValue("1.25");
    expect(screen.getByLabelText("Equipment category")).toHaveValue("Adventuring Gear");
    expect(screen.getByLabelText("Item description")).toHaveValue("Travel lantern.");
    expect(screen.getByLabelText("Name")).toHaveValue("Folding Lantern");
  });

  it("loads edit defaults and freezes resubmission after a stale version", async () => {
    actions.update.mockResolvedValue({ status: "conflict", message: "Reload latest before saving." });
    render(<ItemForm mode="edit" initialValue={{ id: "11111111-1111-4111-8111-111111111111", name: "Lantern", version: 2,
      data: { equipment_category: "Gear", description: "Travel lantern.", cost: { quantity: 0, unit: "gp" }, weight: 1 } }} />);
    expect(screen.getByLabelText("Cost quantity")).toHaveValue("0");
    expect(screen.getByText(/Existing character inventory pins keep their saved version/)).toBeVisible();
    fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeEnabled();
    expect((actions.update.mock.calls[0][1] as FormData).get("expected_version")).toBe("2");
  });
});
