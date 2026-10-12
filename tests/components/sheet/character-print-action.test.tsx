import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printFixture } from "../../../e2e/print/fixtures";
import type { CharacterPrintInput } from "@/lib/character/print-model";

const holder = vi.hoisted(() => ({ ctx: null as CharacterPrintInput | null }));
vi.mock("@/lib/character/character-context", () => ({
  useCharacter: () => holder.ctx,
  useCharacterState: () => holder.ctx,
  useInventory: () => holder.ctx,
  useSpells: () => holder.ctx,
  useRest: () => holder.ctx,
  useResources: () => holder.ctx,
  useRolls: () => holder.ctx,
  useConcentration: () => ({ pendingCheck: holder.ctx?.pendingConcentrationCheck }),
}));
import { CharacterPrintAction } from "@/components/sheet/character-print-action";

describe("character print action", () => {
  beforeEach(() => { holder.ctx = printFixture("caster"); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("opens an isolated paper-safe snapshot, prints and returns focus/title", () => {
    document.title = "Original character";
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<CharacterPrintAction />);
    const trigger = screen.getByRole("button", { name: "Print / Save PDF" });
    fireEvent.click(trigger);
    const preview = screen.getByRole("dialog", { name: "Print preview" });
    expect(preview.parentElement).toBe(document.body);
    expect(preview.textContent).not.toContain("FORBIDDEN_");
    expect(document.title).toBe("Iven Lanternkeeper - Inkborne Character Sheet");
    expect(within(preview).getByRole("button", { name: "Back to character" })).toHaveFocus();
    fireEvent.click(within(preview).getByRole("button", { name: "Print / Save PDF" }));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.keyDown(preview, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus(); expect(document.title).toBe("Original character");
  });
  it("hides export for a non-owner and incomplete sheet", () => {
    holder.ctx!.isOwner = false;
    const view = render(<CharacterPrintAction />);
    expect(screen.queryByRole("button")).toBeNull();
    holder.ctx!.isOwner = true; holder.ctx!.hasSheet = false;
    view.rerender(<CharacterPrintAction />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("refuses pending writes and uncertain rolls", () => {
    holder.ctx!.patchState.hasPendingWrites = () => true;
    const view = render(<CharacterPrintAction />);
    expect(screen.getByRole("button")).toBeDisabled();
    holder.ctx!.patchState.hasPendingWrites = () => false; holder.ctx!.rollPersistenceUncertain = true;
    view.rerender(<CharacterPrintAction />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("shows recovery guidance for an unreadable immutable spell pin", () => {
    holder.ctx!.spells[0].content_definitions = null;
    render(<CharacterPrintAction />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("alert")).toHaveTextContent("saved content version");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("disables print when the server omitted an unreadable content ref", () => {
    holder.ctx!.contentSnapshotsComplete = false;
    render(<CharacterPrintAction />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText("Saved content is incomplete. Reload before printing.")).toBeVisible();
  });
});
