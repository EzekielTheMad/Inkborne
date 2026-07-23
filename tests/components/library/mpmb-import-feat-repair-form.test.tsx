import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useActionState: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useActionState: hooks.useActionState,
}));
vi.mock("@/app/(app)/homebrew/import/actions", () => ({
  repairMpmbImportFeat: vi.fn(),
}));

import { MpmbImportFeatRepairForm } from "@/components/library/mpmb-import-feat-repair-form";

const baseProps = {
  importId: "33333333-3333-4333-8333-333333333333",
  itemId: "44444444-4444-4444-8444-444444444444",
  revision: 3,
  candidateName: "Ember Adept",
};

beforeEach(() => {
  hooks.useActionState.mockReturnValue([
    { status: "idle", message: "" },
    vi.fn(),
    false,
  ]);
});

describe("MpmbImportFeatRepairForm", () => {
  it("renders only diagnosed finite fields", () => {
    render(
      <MpmbImportFeatRepairForm
        {...baseProps}
        repairFields={{
          prerequisites: true,
          action: false,
          recovery: true,
          spellcastingAbility: false,
        }}
      />,
    );

    expect(screen.getByLabelText("Ability")).toHaveValue("");
    expect(screen.getByLabelText("Minimum score")).toHaveAttribute("min", "1");
    expect(screen.getByLabelText("Recovery")).toHaveValue("");
    expect(screen.queryByLabelText("Action economy")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Spellcasting ability")).not.toBeInTheDocument();
    expect(screen.getByText(/data, effects, and import provenance stay intact/i))
      .toBeVisible();
  });

  it("offers strict action, recovery, and spellcasting ability options", () => {
    render(
      <MpmbImportFeatRepairForm
        {...baseProps}
        repairFields={{
          prerequisites: false,
          action: true,
          recovery: true,
          spellcastingAbility: true,
        }}
        initialAction="reaction"
        initialRecovery="short rest"
        initialSpellcastingAbility="wisdom"
      />,
    );

    expect(screen.getByLabelText("Action economy")).toHaveValue("reaction");
    expect(screen.getByLabelText("Recovery")).toHaveValue("short rest");
    expect(screen.getByLabelText("Ability")).toHaveValue("wisdom");
    expect(screen.getByRole("option", { name: "No tracked action" })).toBeVisible();
    expect(screen.getByRole("option", { name: "No recovery" })).toBeVisible();
    expect(screen.getByRole("option", { name: "No spellcasting ability" })).toBeVisible();
  });

  it("shows field errors and prevents resubmitting a stale repair", () => {
    hooks.useActionState.mockReturnValue([
      {
        status: "conflict",
        message: "This import changed in another session.",
        fieldErrors: {
          spellcasting_ability: ["Choose a standard ability."],
        },
      },
      vi.fn(),
      false,
    ]);

    render(
      <MpmbImportFeatRepairForm
        {...baseProps}
        repairFields={{
          prerequisites: false,
          action: false,
          recovery: false,
          spellcastingAbility: true,
        }}
      />,
    );

    expect(screen.getByText("Choose a standard ability.")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This import changed in another session.",
    );
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save missing details" })).toBeDisabled();
  });
});
