import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useActionState: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useActionState: hooks.useActionState,
}));
vi.mock("@/app/(app)/library/import/actions", () => ({
  resolveMpmbImportConflict: vi.fn(),
}));

import { MpmbImportConflictResolutionForm } from "@/components/library/mpmb-import-conflict-resolution-form";

const baseProps = {
  importId: "33333333-3333-4333-8333-333333333333",
  itemId: "44444444-4444-4444-8444-444444444444",
  revision: 4,
  candidateName: "Ember Ward",
  conflictResolution: null,
  replacementContentId: null,
  replacementExpectedVersion: null,
};

const privateTarget = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Ember Ward",
  version: 3,
  scope: "personal" as const,
  sharedCampaignCount: 0,
  previouslyImported: true,
  replaceable: true,
};

const sharedTarget = {
  ...privateTarget,
  id: "66666666-6666-4666-8666-666666666666",
  version: 2,
  scope: "shared" as const,
  sharedCampaignCount: 2,
  previouslyImported: false,
  replaceable: false,
};

beforeEach(() => {
  hooks.useActionState.mockReturnValue([
    { status: "idle", message: "" },
    vi.fn(),
    false,
  ]);
});

describe("MpmbImportConflictResolutionForm", () => {
  it("requires an explicit strategy and can choose keep-both", () => {
    const { container } = render(
      <MpmbImportConflictResolutionForm
        {...baseProps}
        conflicts={[privateTarget]}
      />,
    );

    const submit = screen.getByRole("button", { name: "Save resolution" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Keep both/ }));

    expect(submit).toBeEnabled();
    expect(container.querySelector<HTMLInputElement>('input[name="strategy"]'))
      .toHaveValue("keep_both");
    expect(screen.getByText(/collision-safe internal slug/i)).toBeVisible();
  });

  it("submits only the exact private target id and version for replacement", () => {
    const { container } = render(
      <MpmbImportConflictResolutionForm
        {...baseProps}
        conflicts={[privateTarget]}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Replace Ember Ward/ }));

    expect(container.querySelector<HTMLInputElement>('input[name="strategy"]'))
      .toHaveValue("replace");
    expect(container.querySelector<HTMLInputElement>('input[name="target_content_id"]'))
      .toHaveValue(privateTarget.id);
    expect(container.querySelector<HTMLInputElement>('input[name="target_content_version"]'))
      .toHaveValue(String(privateTarget.version));
    expect(screen.getByText(/whole-definition and private/i)).toBeVisible();
    expect(screen.getByText("Previously imported")).toBeVisible();
  });

  it("disables shared replacement without withdrawing campaign access", () => {
    render(
      <MpmbImportConflictResolutionForm
        {...baseProps}
        conflicts={[sharedTarget]}
      />,
    );

    expect(screen.getByRole("radio", { name: /Replace Ember Ward/ })).toBeDisabled();
    expect(screen.getByText(/Shared with 2 campaigns/)).toBeVisible();
    expect(screen.getByText(/will not withdraw access automatically/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save resolution" })).toBeDisabled();
  });

  it("shows the returned conflict and pending state", () => {
    hooks.useActionState.mockReturnValue([
      { status: "conflict", message: "This target changed. Review it again." },
      vi.fn(),
      true,
    ]);

    render(
      <MpmbImportConflictResolutionForm
        {...baseProps}
        conflictResolution="replace"
        replacementContentId={privateTarget.id}
        replacementExpectedVersion={privateTarget.version}
        conflicts={[privateTarget]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This target changed");
    expect(screen.getByRole("button", { name: "Saving resolution..." })).toBeDisabled();
  });
});
