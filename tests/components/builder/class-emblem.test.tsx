import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassEmblem } from "@/components/builder/class-emblem";

describe("ClassEmblem", () => {
  it("renders the emblem letter for the given class", () => {
    render(<ClassEmblem slug="paladin" name="Paladin" size="md" />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("applies the gold tone to martial classes", () => {
    const { container } = render(
      <ClassEmblem slug="paladin" name="Paladin" size="md" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.dataset.tone).toBe("gold");
  });

  it("applies the purple tone to caster classes", () => {
    const { container } = render(
      <ClassEmblem slug="wizard" name="Wizard" size="md" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.dataset.tone).toBe("purple");
  });

  it("hides the emblem letter from screen readers", () => {
    render(<ClassEmblem slug="paladin" name="Paladin" size="md" />);
    const letter = screen.getByText("P");
    expect(letter.parentElement?.getAttribute("aria-hidden")).toBe("true");
  });
});
