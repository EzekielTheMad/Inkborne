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

describe("ClassPreviewModal — features tab", () => {
  function setupPaladinWithFeatures() {
    const features: ContentEntry[] = [
      {
        id: "f1",
        name: "Divine Sense",
        slug: "divine-sense",
        content_type: "feature",
        data: { description: "Detect celestials, fiends, undead." },
        effects: [],
        version: 1,
        source: "srd",
      },
      {
        id: "f2",
        name: "Sacred Oath",
        slug: "sacred-oath",
        content_type: "feature",
        data: { description: "Pick an oath at level 3." },
        effects: [],
        version: 1,
        source: "srd",
      },
      {
        id: "f3",
        name: "Channel Divinity: Sacred Weapon",
        slug: "cd-sacred-weapon",
        content_type: "feature",
        data: { description: "Devotion oath feature.", subclass: "oath-of-devotion" },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    const paladin = makeClass({
      data: {
        hit_die: 10,
        primaryAbility: "STR + CHA",
        levels: [
          { level: 1, features: ["divine-sense"] },
          { level: 3, features: ["sacred-oath", "cd-sacred-weapon"] },
        ],
      },
    });
    return { paladin, features };
  }

  it("hides features above the preview level", () => {
    const { paladin, features } = setupPaladinWithFeatures();
    render(
      <ClassPreviewModal
        open={true}
        classContent={paladin}
        features={features}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    expect(screen.getByText("Divine Sense")).toBeInTheDocument();
    expect(screen.queryByText("Sacred Oath")).not.toBeInTheDocument();
  });

  it("hides subclass-locked features until the matching subclass is previewed", () => {
    const { paladin, features } = setupPaladinWithFeatures();
    const subclasses: ContentEntry[] = [
      {
        id: "sc1",
        name: "Oath of Devotion",
        slug: "oath-of-devotion",
        content_type: "subclass",
        data: { class: "paladin" },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    render(
      <ClassPreviewModal
        open={true}
        classContent={paladin}
        features={features}
        subclasses={subclasses}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    // Bump the preview level to 3.
    fireEvent.change(screen.getByLabelText("Preview level"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    expect(screen.getByText("Sacred Oath")).toBeInTheDocument();
    // Subclass-locked feature is hidden until subclass picked.
    expect(screen.queryByText("Channel Divinity: Sacred Weapon")).not.toBeInTheDocument();

    // Pick the subclass on the Subclasses tab.
    fireEvent.click(screen.getByRole("tab", { name: /subclasses/i }));
    fireEvent.click(screen.getByRole("button", { name: /Oath of Devotion/i }));
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    expect(screen.getByText("Channel Divinity: Sacred Weapon")).toBeInTheDocument();
  });
});

describe("ClassPreviewModal — subclasses tab", () => {
  it("toggles subclass selection on click", () => {
    const subclasses: ContentEntry[] = [
      {
        id: "sc1",
        name: "Oath of Devotion",
        slug: "oath-of-devotion",
        content_type: "subclass",
        data: { class: "paladin", description: "Holy paladin." },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={subclasses}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /subclasses/i }));
    const card = screen.getByRole("button", { name: /Oath of Devotion/i });
    expect(card.dataset.selected).toBeUndefined();
    fireEvent.click(card);
    expect(card.dataset.selected).toBe("true");
    fireEvent.click(card);
    expect(card.dataset.selected).toBeUndefined();
  });
});

describe("ClassPreviewModal — spells tab", () => {
  it("filters spells by level chip", () => {
    const wizard = makeClass({
      slug: "wizard",
      name: "Wizard",
      data: {
        hit_die: 6,
        primaryAbility: "INT",
        spellsKnown: "all",
        levels: [{ level: 1, features: [] }],
      },
    });
    const spells: ContentEntry[] = [
      {
        id: "s1",
        name: "Mage Hand",
        slug: "mage-hand",
        content_type: "spell",
        data: { level: 0, school: "conjuration", classes: ["wizard"] },
        effects: [],
        version: 1,
        source: "srd",
      },
      {
        id: "s2",
        name: "Magic Missile",
        slug: "magic-missile",
        content_type: "spell",
        data: { level: 1, school: "evocation", classes: ["wizard"] },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    render(
      <ClassPreviewModal
        open={true}
        classContent={wizard}
        features={[]}
        subclasses={[]}
        spells={spells}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /spells/i }));
    expect(screen.getByText("Mage Hand")).toBeInTheDocument();
    expect(screen.getByText("Magic Missile")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Cantrip$/ }));
    expect(screen.getByText("Mage Hand")).toBeInTheDocument();
    expect(screen.queryByText("Magic Missile")).not.toBeInTheDocument();
  });
});

describe("ClassPreviewModal — callbacks", () => {
  it("calls onPick with the class slug and the current subclass selection", () => {
    const onPick = vi.fn();
    const subclasses: ContentEntry[] = [
      {
        id: "sc1",
        name: "Oath of Devotion",
        slug: "oath-of-devotion",
        content_type: "subclass",
        data: { class: "paladin" },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={subclasses}
        spells={[]}
        onCancel={vi.fn()}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /subclasses/i }));
    fireEvent.click(screen.getByRole("button", { name: /Oath of Devotion/i }));
    fireEvent.click(screen.getByRole("button", { name: /Pick this class/i }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({
      classSlug: "paladin",
      subclassSlug: "oath-of-devotion",
    });
  });

  it("calls onCancel and never onPick when Cancel is clicked", () => {
    const onCancel = vi.fn();
    const onPick = vi.fn();
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={onCancel}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("ClassPreviewModal — reset on open", () => {
  it("resets active tab and previewLevel when a different class is opened", () => {
    const paladin = makeClass();
    const wizard = makeClass({
      id: "c2",
      slug: "wizard",
      name: "Wizard",
      data: {
        hit_die: 6,
        primaryAbility: "INT",
        spellsKnown: "all",
        levels: [{ level: 1, features: [] }, { level: 2, features: [] }],
      },
    });
    const { rerender } = render(
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
    // Move to features tab and bump level.
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    fireEvent.change(screen.getByLabelText("Preview level"), { target: { value: "2" } });

    // Re-render with a different class (mimics opening a new card).
    rerender(
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
    // Active tab should be reset to overview, preview level to 1.
    expect(screen.getByRole("tabpanel", { name: /overview/i })).toBeInTheDocument();
    expect((screen.getByLabelText("Preview level") as HTMLSelectElement).value).toBe("1");
  });
});
