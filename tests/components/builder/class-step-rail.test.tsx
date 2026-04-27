import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import type { ContentEntry } from "@/components/builder/content-browser";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LevelPill", () => {
  it("renders the level number and summary", () => {
    render(<LevelPill level={3} summary="Sacred Oath" hasUnmadeChoice={false} active={false} onClick={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Sacred Oath")).toBeInTheDocument();
  });

  it("shows the unmade-choice indicator when hasUnmadeChoice is true", () => {
    render(<LevelPill level={4} summary="ASI" hasUnmadeChoice={true} active={false} onClick={vi.fn()} />);
    expect(screen.getByLabelText("Has unmade choice")).toBeInTheDocument();
  });

  it("hides the unmade-choice indicator when hasUnmadeChoice is false", () => {
    render(<LevelPill level={1} summary="Divine Sense" hasUnmadeChoice={false} active={false} onClick={vi.fn()} />);
    expect(screen.queryByLabelText("Has unmade choice")).not.toBeInTheDocument();
  });

  it("marks the active pill with aria-current='true'", () => {
    render(<LevelPill level={2} summary="Fighting Style" hasUnmadeChoice={false} active={true} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /level 2/i })).toHaveAttribute("aria-current", "true");
  });

  it("calls onClick when activated", () => {
    const onClick = vi.fn();
    render(<LevelPill level={2} summary="Fighting Style" hasUnmadeChoice={false} active={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /level 2/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

function passiveFeature(): ContentEntry {
  return {
    id: "f1",
    slug: "divine-sense",
    name: "Divine Sense",
    content_type: "feature",
    data: { description: "Detect celestials, fiends, undead.", level: 1, class: "paladin" },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("FeatureCard", () => {
  it("renders the feature name and description", () => {
    render(<FeatureCard feature={passiveFeature()} />);
    expect(screen.getByText("Divine Sense")).toBeInTheDocument();
    expect(screen.getByText("Detect celestials, fiends, undead.")).toBeInTheDocument();
  });

  it("renders without a description if absent", () => {
    const f = passiveFeature();
    f.data = { level: 1, class: "paladin" };
    render(<FeatureCard feature={f} />);
    expect(screen.getByText("Divine Sense")).toBeInTheDocument();
  });
});

import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";

describe("ChoiceCardASI", () => {
  it("shows 'Choose' badge when no choice is made", () => {
    render(
      <ChoiceCardASI featureSlug="paladin-asi-4" currentChoice={undefined} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("Choose")).toBeInTheDocument();
  });

  it("shows 'Chosen' badge when a choice exists", () => {
    render(
      <ChoiceCardASI
        featureSlug="paladin-asi-4"
        currentChoice={{ mode: "asi", allocations: [{ ability: "strength", amount: 2 }] }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Chosen")).toBeInTheDocument();
  });

  it("calls onSelect with a +2 allocation when the user picks +2 to strength", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCardASI featureSlug="paladin-asi-4" currentChoice={undefined} onSelect={onSelect} />,
    );
    // Toggle to "Increase one ability by 2" mode (default in this test) and click STR.
    fireEvent.click(screen.getByRole("button", { name: /^STR \+2$/ }));
    expect(onSelect).toHaveBeenCalledWith({
      mode: "asi",
      allocations: [{ ability: "strength", amount: 2 }],
    });
  });

  it("calls onSelect with two +1 allocations in two-stat mode", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCardASI featureSlug="paladin-asi-4" currentChoice={undefined} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /two abilities by \+1/i }));
    fireEvent.click(screen.getByRole("button", { name: /^STR \+1$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^DEX \+1$/ }));
    // The last call carries the final state: STR+1 + DEX+1.
    const lastCall = onSelect.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({
      mode: "asi",
      allocations: expect.arrayContaining([
        { ability: "strength", amount: 1 },
        { ability: "dexterity", amount: 1 },
      ]),
    });
  });
});

import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";

function subclass(slug: string, name: string, parentClass: string, description?: string): ContentEntry {
  return {
    id: `sc-${slug}`,
    slug,
    name,
    content_type: "subclass",
    data: { parent_class: parentClass, description },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("ChoiceCardSubclass", () => {
  it("renders subclass cards filtered to the matching class", () => {
    render(
      <ChoiceCardSubclass
        classSlug="paladin"
        subclasses={[
          subclass("devotion", "Oath of Devotion", "paladin"),
          subclass("ancients", "Oath of the Ancients", "paladin"),
          subclass("evocation", "Evocation", "wizard"),
        ]}
        currentSelection={undefined}
        onSelect={vi.fn()}
        label="Sacred Oath"
      />,
    );
    expect(screen.getByText("Oath of Devotion")).toBeInTheDocument();
    expect(screen.getByText("Oath of the Ancients")).toBeInTheDocument();
    expect(screen.queryByText("Evocation")).not.toBeInTheDocument();
  });

  it("shows 'Chosen' when a subclass is selected", () => {
    render(
      <ChoiceCardSubclass
        classSlug="paladin"
        subclasses={[subclass("devotion", "Oath of Devotion", "paladin")]}
        currentSelection="devotion"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Chosen")).toBeInTheDocument();
  });

  it("calls onSelect with the slug when a card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCardSubclass
        classSlug="paladin"
        subclasses={[subclass("devotion", "Oath of Devotion", "paladin")]}
        currentSelection={undefined}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Oath of Devotion/i }));
    expect(onSelect).toHaveBeenCalledWith("devotion");
  });
});

import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";

function styleEntry(slug: string, name: string, description?: string): ContentEntry {
  return {
    id: `style-${slug}`,
    slug,
    name,
    content_type: "feature",
    data: { feature_type: "fighting_style", description },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("ChoiceCardFightingStyle", () => {
  it("renders style options stripped of the 'Fighting Style: ' prefix", () => {
    render(
      <ChoiceCardFightingStyle
        featureSlug="fighter-fighting-style"
        classSlug="fighter"
        styleOptions={[
          styleEntry("fs-archery", "Fighting Style: Archery"),
          styleEntry("fs-defense", "Fighting Style: Defense"),
        ]}
        currentStyleSlug={undefined}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Archery")).toBeInTheDocument();
    expect(screen.getByText("Defense")).toBeInTheDocument();
  });

  it("shows 'Chosen' when a style is selected", () => {
    render(
      <ChoiceCardFightingStyle
        featureSlug="fighter-fighting-style"
        classSlug="fighter"
        styleOptions={[styleEntry("fs-archery", "Fighting Style: Archery")]}
        currentStyleSlug="fs-archery"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Chosen")).toBeInTheDocument();
  });

  it("calls onSelect with the style slug + class slug when a style is picked", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCardFightingStyle
        featureSlug="fighter-fighting-style"
        classSlug="fighter"
        styleOptions={[styleEntry("fs-archery", "Fighting Style: Archery")]}
        currentStyleSlug={undefined}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Archery/i }));
    expect(onSelect).toHaveBeenCalledWith("fighter-fighting-style", "fighter", "fs-archery");
  });
});

import { AddClassRow } from "@/components/builder/class-step-rail/add-class-row";

describe("AddClassRow", () => {
  it("renders the locked label and reasons text", () => {
    render(<AddClassRow reasons={["Requires CHA 13 for Bard", "Requires INT 13 for Wizard"]} />);
    expect(screen.getByText(/Add a class · Locked/i)).toBeInTheDocument();
    expect(screen.getByText(/Requires CHA 13 for Bard/i)).toBeInTheDocument();
  });

  it("is aria-disabled and click is a no-op", () => {
    render(<AddClassRow reasons={["Requires CHA 13 for Bard"]} />);
    const btn = screen.getByRole("button", { name: /Add a class/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    // Clicking does nothing observable — just confirm no error and no state change.
    fireEvent.click(btn);
    expect(btn).toBeInTheDocument();
  });
});

import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import { LevelRail } from "@/components/builder/class-step-rail/level-rail";
import type { PerLevel } from "@/lib/builder/class-features-per-level";

function makePerLevel(): PerLevel[] {
  return [
    { level: 1, features: [], choices: [] },
    {
      level: 3,
      features: [],
      choices: [
        { type: "subclass", classSlug: "paladin", label: "Sacred Oath", isMade: false },
      ],
    },
    {
      level: 4,
      features: [],
      choices: [
        { type: "asi", featureSlug: "paladin-asi-4", classSlug: "paladin", label: "Ability Score Improvement", isMade: true },
      ],
    },
  ];
}

describe("LevelRail", () => {
  it("renders one pill per level row", () => {
    render(
      <LevelRail
        classSlug="paladin"
        className_={"Paladin"}
        subclassName={undefined}
        currentLevel={4}
        perLevel={makePerLevel()}
        activeLevel={1}
        onSelectLevel={vi.fn()}
        onLevelChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /level 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /level 3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /level 4/i })).toBeInTheDocument();
  });

  it("shows the unmade-choice red dot only on rows with isMade=false", () => {
    render(
      <LevelRail
        classSlug="paladin"
        className_={"Paladin"}
        subclassName={undefined}
        currentLevel={4}
        perLevel={makePerLevel()}
        activeLevel={1}
        onSelectLevel={vi.fn()}
        onLevelChange={vi.fn()}
      />,
    );
    // Level 3 has unmade subclass → dot present
    // Level 4 has made ASI → dot absent
    const indicators = screen.getAllByLabelText("Has unmade choice");
    expect(indicators.length).toBe(1);
  });

  it("calls onSelectLevel when a pill is clicked", () => {
    const onSelectLevel = vi.fn();
    render(
      <LevelRail
        classSlug="paladin"
        className_={"Paladin"}
        subclassName={undefined}
        currentLevel={4}
        perLevel={makePerLevel()}
        activeLevel={1}
        onSelectLevel={onSelectLevel}
        onLevelChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /level 3/i }));
    expect(onSelectLevel).toHaveBeenCalledWith(3);
  });

  it("calls onLevelChange with parsed integer when the level dropdown changes", () => {
    const onLevelChange = vi.fn();
    render(
      <LevelRail
        classSlug="paladin"
        className_={"Paladin"}
        subclassName={undefined}
        currentLevel={4}
        perLevel={makePerLevel()}
        activeLevel={1}
        onSelectLevel={vi.fn()}
        onLevelChange={onLevelChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Set level for Paladin"), { target: { value: "6" } });
    expect(onLevelChange).toHaveBeenCalledWith(6);
  });
});

function f(slug: string, name: string, description?: string): ContentEntry {
  return {
    id: `f-${slug}`,
    slug,
    name,
    content_type: "feature",
    data: { description },
    effects: [],
    version: 1,
    source: "srd",
  };
}

const noopHandlers = {
  onAsiSelect: vi.fn(),
  onSubclassSelect: vi.fn(),
  onFightingStyleSelect: vi.fn(),
};

describe("ClassLevelPane", () => {
  it("titles the pane after the choice when present", () => {
    const row: PerLevel = {
      level: 3,
      features: [f("divine-health", "Divine Health"), f("oath-spells", "Oath Spells")],
      choices: [{ type: "subclass", classSlug: "paladin", label: "Sacred Oath", isMade: false }],
    };
    render(
      <ClassLevelPane
        classSlug="paladin"
        className_={"Paladin"}
        classIndex={0}
        row={row}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{}}
        currentSubclass={undefined}
        {...noopHandlers}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Sacred Oath" })).toBeInTheDocument();
  });

  it("titles the pane after the single feature when there are no choices", () => {
    const row: PerLevel = {
      level: 1,
      features: [f("divine-sense", "Divine Sense", "Detect celestials.")],
      choices: [],
    };
    render(
      <ClassLevelPane
        classSlug="paladin"
        className_={"Paladin"}
        classIndex={0}
        row={row}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{}}
        currentSubclass={undefined}
        {...noopHandlers}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Divine Sense" })).toBeInTheDocument();
  });

  it("falls back to 'Level N' for multi-feature levels with no choices", () => {
    const row: PerLevel = {
      level: 3,
      features: [f("divine-health", "Divine Health"), f("channel-divinity", "Channel Divinity")],
      choices: [],
    };
    render(
      <ClassLevelPane
        classSlug="paladin"
        className_={"Paladin"}
        classIndex={0}
        row={row}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{}}
        currentSubclass={undefined}
        {...noopHandlers}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Level 3" })).toBeInTheDocument();
  });

  it("renders feature cards and choice cards together", () => {
    const row: PerLevel = {
      level: 4,
      features: [f("divine-health", "Divine Health")],
      choices: [{ type: "asi", featureSlug: "paladin-asi-4", classSlug: "paladin", label: "Ability Score Improvement", isMade: false }],
    };
    render(
      <ClassLevelPane
        classSlug="paladin"
        className_={"Paladin"}
        classIndex={0}
        row={row}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{}}
        currentSubclass={undefined}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText("Divine Health")).toBeInTheDocument();
    expect(screen.getByText("Ability Score Improvement")).toBeInTheDocument();
  });
});
