import type { ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContentTabs } from "@/components/sheet/content-tabs";

vi.mock("@/components/sheet/tabs/actions-tab", () => ({ ActionsTab: () => <h2>Actions panel</h2> }));
vi.mock("@/components/sheet/tabs/spells-tab", () => ({ SpellsTab: () => <h2>Spells panel</h2> }));
vi.mock("@/components/sheet/tabs/inventory-tab", () => ({ InventoryTab: () => <h2>Inventory panel</h2> }));
vi.mock("@/components/sheet/tabs/features-tab", () => ({ FeaturesTab: () => <h2>Features panel</h2> }));
vi.mock("@/components/sheet/tabs/notes-tab", () => ({ NotesTab: () => <h2>Notes panel</h2> }));

// Panels are mocked: this test exercises the real tab controls and hydration.
const props = {
  character: {} as ComponentProps<typeof ContentTabs>["character"],
  schema: {} as ComponentProps<typeof ContentTabs>["schema"],
  evalResult: {} as ComponentProps<typeof ContentTabs>["evalResult"],
  contentRefs: [], state: {}, patchState: vi.fn().mockResolvedValue(true),
};

describe("ContentTabs hydration", () => {
  it("keeps server controls disabled until hydration, then navigates to the clicked panel", async () => {
    const view = <ContentTabs {...props} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(view);
    document.body.appendChild(container);
    const ui = within(container), recoverableError = vi.fn();
    let root: Root | undefined;
    try {
      const buttons = ui.getAllByRole("button");
      expect(buttons).toHaveLength(5);
      for (const button of buttons) expect(button).toBeDisabled();
      (ui.getByRole("button", { name: "Inventory", exact: true }) as HTMLButtonElement).click();
      expect(ui.getByRole("heading", { name: "Actions panel", exact: true })).toBeVisible();
      expect(ui.queryByRole("heading", { name: "Inventory panel", exact: true })).not.toBeInTheDocument();

      await act(async () => { root = hydrateRoot(container, view, { onRecoverableError: recoverableError }); });
      for (const button of ui.getAllByRole("button")) expect(button).toBeEnabled();
      expect(recoverableError).not.toHaveBeenCalled();
      for (const name of ["Inventory", "Spells", "Features", "Notes", "Actions"]) {
        fireEvent.click(ui.getByRole("button", { name, exact: true }));
        expect(ui.getByRole("heading", { name: `${name} panel`, exact: true })).toBeVisible();
        expect(ui.getAllByRole("heading")).toHaveLength(1);
      }
    } finally {
      if (root) await act(async () => { root?.unmount(); });
      container.remove();
    }
  });
});
