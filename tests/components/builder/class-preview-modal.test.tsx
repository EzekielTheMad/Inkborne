import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassPreviewModal } from "@/components/builder/class-preview-modal";
import type { ContentEntry } from "@/components/builder/content-browser";

function makeClass(overrides: Partial<ContentEntry> = {}): ContentEntry {
  return {
    id: "c1",
    name: "Paladin",
    slug: "paladin",
    content_type: "class",
    data: {
      hit_die: 10,
      primaryAbility: "STR + CHA",
      saving_throws: ["wisdom", "charisma"],
      levels: [
        { level: 1, features: ["divine-sense"] },
        { level: 2, features: ["divine-smite"] },
      ],
    },
    effects: [],
    version: 1,
    source: "srd",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClassPreviewModal", () => {
  it("renders the class name when open", () => {
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByText("Paladin")).toBeInTheDocument();
  });

  it("renders nothing when classContent is null", () => {
    const { container } = render(
      <ClassPreviewModal
        open={true}
        classContent={null}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    // Nothing is portaled to body either.
    expect(document.body.textContent).not.toContain("Paladin");
    expect(container.textContent).toBe("");
  });
});
