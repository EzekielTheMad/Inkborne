import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterRow, formatClassLine } from "@/components/characters/character-row";
import type { CharacterChoices } from "@/lib/types/character";

describe("formatClassLine", () => {
  it("returns null when there are no class choices", () => {
    expect(formatClassLine(null)).toBeNull();
    expect(formatClassLine(undefined)).toBeNull();
    expect(formatClassLine({ classes: [] } as unknown as CharacterChoices)).toBeNull();
  });

  it("capitalizes single-class slugs with level", () => {
    const choices = { classes: [{ slug: "wizard", level: 5 }] } as unknown as CharacterChoices;
    expect(formatClassLine(choices)).toBe("Wizard 5");
  });

  it("joins multiclass entries with a slash", () => {
    const choices = {
      classes: [
        { slug: "paladin", level: 2 },
        { slug: "sorcerer", level: 3 },
      ],
    } as unknown as CharacterChoices;
    expect(formatClassLine(choices)).toBe("Paladin 2 / Sorcerer 3");
  });
});

describe("<CharacterRow>", () => {
  it("renders name, level tag and subtitle as a link", () => {
    render(
      <CharacterRow
        href="/characters/abc"
        name="Thalindra Moonweave"
        level={5}
        subtitle="Wizard 5 · D&D 5e (2014)"
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/characters/abc");
    expect(screen.getByText("Thalindra Moonweave")).toBeInTheDocument();
    expect(screen.getByText(/LVL 5/)).toBeInTheDocument();
    expect(screen.getByText("Wizard 5 · D&D 5e (2014)")).toBeInTheDocument();
  });

  it("marks unbuilt characters as unwritten instead of showing a level", () => {
    render(
      <CharacterRow
        href="/characters/xyz"
        name="Nameless One"
        level={null}
        subtitle="Not built yet"
      />,
    );
    expect(screen.getByText(/unwritten/)).toBeInTheDocument();
    expect(screen.queryByText(/LVL/)).not.toBeInTheDocument();
  });
});
