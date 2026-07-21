import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useActionState: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useActionState: hooks.useActionState,
}));
vi.mock("@/app/(app)/library/import/actions", () => ({
  repairMpmbImportSpell: vi.fn(),
}));

import { MpmbImportSpellRepairForm } from "@/components/library/mpmb-import-spell-repair-form";

const baseProps = {
  importId: "33333333-3333-4333-8333-333333333333",
  itemId: "44444444-4444-4444-8444-444444444444",
  revision: 3,
  candidateName: "Ash Veil",
};

beforeEach(() => {
  hooks.useActionState.mockReturnValue([
    { status: "idle", message: "" },
    vi.fn(),
    false,
  ]);
});

describe("MpmbImportSpellRepairForm", () => {
  it("renders only the supported missing fields with safe defaults", () => {
    render(
      <MpmbImportSpellRepairForm
        {...baseProps}
        repairFields={{ material: true, dc: true }}
      />,
    );

    expect(screen.getByLabelText("Required material")).toBeRequired();
    expect(screen.getByLabelText("Save ability")).toBeRequired();
    expect(screen.getByLabelText("On a successful save")).toBeRequired();
    expect(screen.getByText(/only the missing fields below will change/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save missing details" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Back to review" })).toHaveAttribute(
      "href",
      `/library/import/${baseProps.importId}`,
    );
  });

  it("shows returned field errors and a pending state for a material-only repair", () => {
    hooks.useActionState.mockReturnValue([
      {
        status: "error",
        message: "Correct the highlighted repair fields.",
        fieldErrors: { material: ["Enter the spell's material component."] },
      },
      vi.fn(),
      true,
    ]);

    render(
      <MpmbImportSpellRepairForm
        {...baseProps}
        repairFields={{ material: true, dc: false }}
      />,
    );

    expect(screen.getByText("Enter the spell's material component.")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Correct the highlighted repair fields.",
    );
    expect(screen.queryByLabelText("Save ability")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving correction..." })).toBeDisabled();
  });
});
