import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
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

describe("ClassPreviewModal — tabs", () => {
  it("shows 4 tabs when the class is a caster (has spellsKnown)", () => {
    const wizard = makeClass({
      slug: "wizard",
      name: "Wizard",
      data: {
        hit_die: 6,
        primaryAbility: "INT",
        spellsKnown: "all",
        levels: [{ level: 1, features: ["arcane-recovery"] }],
      },
    });
    render(
      <ClassPreviewModal
        open={true}
        classContent={wizard}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /features/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /subclasses/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /spells/i })).toBeInTheDocument();
  });

  it("hides the Spells tab when the class is not a caster", () => {
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
    expect(screen.queryByRole("tab", { name: /spells/i })).not.toBeInTheDocument();
  });

  it("switches the visible tab body when a different tab is clicked", () => {
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
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    expect(screen.getByRole("tabpanel", { name: /features/i })).toBeInTheDocument();
  });
});

describe("ClassPreviewModal — overview tab", () => {
  it("shows the class description when present", () => {
    const paladin = makeClass({
      data: {
        hit_die: 10,
        primaryAbility: "STR + CHA",
        saving_throws: ["wisdom", "charisma"],
        description: "A holy warrior bound by an oath.",
        levels: [{ level: 1, features: [] }],
      },
    });
    render(
      <ClassPreviewModal
        open={true}
        classContent={paladin}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    expect(
      screen.getByText("A holy warrior bound by an oath."),
    ).toBeInTheDocument();
  });
});
