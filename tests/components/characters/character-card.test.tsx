import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CharacterCard } from "@/components/characters/character-card";
import type { Character } from "@/lib/types/character";

type CardCharacter = Character & { game_systems: { name: string } | null; campaigns: { name: string } | null };
function character(changes: Partial<CardCharacter> = {}): CardCharacter {
  return {
    id: "mara", user_id: "owner-1", system_id: "system-1", campaign_id: "campaign-1",
    name: "Mara Stonepath", level: 5, visibility: "private", archived: false,
    choices: { race: "elf", subrace: "high", classes: [{ slug: "wizard", level: 3 }, { slug: "fighter", level: 2 }] },
    base_stats: {}, state: {}, narrative: {}, narrative_rich: {}, primary_color: null,
    created_at: "2026-10-24T00:00:00Z", game_systems: { name: "D&D 5e 2014" },
    campaigns: { name: "The Bellmere Road" }, ...changes,
  };
}

// The semantic source maps are supplied before paint. Locate their owning
// element rather than asserting generated CSS class names or a fixed wrapper.
function accentScope(element: HTMLElement): HTMLElement {
  let current: HTMLElement | null = element;
  while (current && !current.style.getPropertyValue("--character-light-source")) current = current.parentElement;
  if (!current) throw new Error("Character card has no owning semantic accent maps");
  return current;
}

afterEach(cleanup);

describe("CharacterCard", () => {
  it("keeps one character navigation target with race, multiclass, level, system and campaign metadata", () => {
    render(<CharacterCard character={character()} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/characters/mara");
    expect(link).toHaveTextContent("Mara Stonepath");
    expect(link).toHaveTextContent("High Elf · Wizard 3 / Fighter 2");
    expect(link).toHaveTextContent("LVL 5");
    expect(link).toHaveTextContent("D&D 5e 2014");
    expect(link).toHaveTextContent("Campaign · The Bellmere Road");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps an unwritten character linked to its character page without claiming a class or completion", () => {
    render(<CharacterCard character={character({ choices: {}, campaigns: null })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/characters/mara");
    expect(link).toHaveTextContent(/Unwritten.*builder awaits/);
    expect(link).not.toHaveTextContent(/LVL|Wizard|Fighter/);
    expect(link.querySelector('a[href*="/builder"]')).toBeNull();
  });

  it("retains the unknown-system fallback when optional joined metadata is absent", () => {
    render(<CharacterCard character={character({ game_systems: null, campaigns: null })} />);
    expect(screen.getByRole("link")).toHaveTextContent("Unknown system");
    expect(screen.queryByText("The Bellmere Road")).not.toBeInTheDocument();
    expect(screen.getByRole("link")).not.toHaveTextContent(/Campaign/i);
  });

  it("carries a stored portrait through to the card", () => {
    render(<CharacterCard character={character({ narrative: { portrait_url: "/local-mara-portrait.png" } })} />);
    expect(screen.getByRole("img", { name: "Mara Stonepath" })).toHaveAttribute("src", "/local-mara-portrait.png");
  });

  it("keeps differently colored cards in separate scopes and supplies theme-aware defaults", () => {
    render(<>
      <CharacterCard character={character({ id: "white", name: "White Lantern", primary_color: "#FFFFFF" })} />
      <CharacterCard character={character({ id: "purple", name: "Purple Lantern", primary_color: "#7c3aed" })} />
      <CharacterCard character={character({ id: "default", name: "Default Lantern", primary_color: null })} />
    </>);
    const white = accentScope(screen.getByRole("link", { name: /White Lantern/ }));
    const purple = accentScope(screen.getByRole("link", { name: /Purple Lantern/ }));
    const site = accentScope(screen.getByRole("link", { name: /Default Lantern/ }));
    expect(white).not.toBe(purple);
    expect(white.style.getPropertyValue("--character-light-source")).toBe("#FFFFFF");
    expect(white.style.getPropertyValue("--character-dark-source")).toBe("#FFFFFF");
    expect(purple.style.getPropertyValue("--character-light-source")).toBe("#7c3aed");
    expect(purple.style.getPropertyValue("--character-dark-source")).toBe("#7c3aed");
    expect(site.style.getPropertyValue("--character-light-source")).toBe("#785923");
    expect(site.style.getPropertyValue("--character-dark-source")).toBe("#C9A44A");
    // White remains the stored identity source, while readable text receives
    // a separate tone on paper rather than becoming white-on-white.
    expect(white.style.getPropertyValue("--character-light-fg")).not.toBe("#FFFFFF");
    expect(white.style.getPropertyValue("--character-light-fg")).not.toBe("");
  });
});
