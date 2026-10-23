import { render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { CharacterPortalScope, CharacterVisualProvider } from "@/components/character/character-notebook-scope";
import { characterNotebookStyle } from "@/lib/character/notebook-colors";

function PortaledControl() {
  return createPortal(<CharacterPortalScope><button>Portaled control</button></CharacterPortalScope>, document.body);
}

describe("notebook portal isolation", () => {
  it("adds no scope or wrapper outside a character notebook", () => {
    render(<PortaledControl />);
    expect(screen.getByRole("button").parentElement).toBe(document.body);
  });
  it("carries both theme maps across a portal and updates with the active character", () => {
    const { rerender } = render(<CharacterVisualProvider portalClassName="test-portal" style={characterNotebookStyle("#FFFFFF")}><PortaledControl /></CharacterVisualProvider>);
    const popupScope = () => screen.getByRole("button").closest<HTMLElement>("[data-character-portal]")!;
    expect(popupScope().style.getPropertyValue("--character-light-source")).toBe("#FFFFFF");
    expect(popupScope().style.getPropertyValue("--character-dark-source")).toBe("#FFFFFF");
    rerender(<CharacterVisualProvider portalClassName="test-portal" style={characterNotebookStyle("#059669")}><PortaledControl /></CharacterVisualProvider>);
    expect(popupScope().style.getPropertyValue("--character-light-source")).toBe("#059669");
    expect(popupScope().style.getPropertyValue("--character-dark-source")).toBe("#059669");
  });
  it("keeps global chrome in the brand scope beside a nested custom character", () => {
    render(<CharacterVisualProvider portalClassName="test-portal" style={{}}><PortaledControl /><CharacterVisualProvider portalClassName="test-portal" style={characterNotebookStyle("#b91c1c")}><CharacterPortalScope><span>Character control</span></CharacterPortalScope></CharacterVisualProvider></CharacterVisualProvider>);
    expect(screen.getByRole("button").closest<HTMLElement>("[data-character-portal]")!.style.getPropertyValue("--character-light-source")).toBe("");
    expect(screen.getByText("Character control").closest<HTMLElement>("[data-character-portal]")!.style.getPropertyValue("--character-light-source")).toBe("#b91c1c");
  });
});
