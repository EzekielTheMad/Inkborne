import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices } from "@/lib/types/character";

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

describe("AddClassRow — unlocked state", () => {
  it("renders the unlocked label with X levels remaining", () => {
    render(
      <AddClassRow
        unlocked
        levelsRemaining={17}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/Add a class · 17 levels remaining/i)).toBeInTheDocument();
  });

  it("is not aria-disabled in unlocked state", () => {
    render(<AddClassRow unlocked levelsRemaining={20} onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Add a class/i });
    expect(btn).not.toHaveAttribute("aria-disabled", "true");
  });

  it("calls onClick when unlocked button is clicked", () => {
    const onClick = vi.fn();
    render(<AddClassRow unlocked levelsRemaining={20} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Add a class/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClick when locked button is clicked", () => {
    const onClick = vi.fn();
    render(
      <AddClassRow
        reasons={["Requires CHA 13 for Bard"]}
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add a class/i }));
    expect(onClick).not.toHaveBeenCalled();
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
  onChoiceSelect: vi.fn(),
  classChoices: [],
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

import { ChoiceCardGeneric } from "@/components/builder/class-step-rail/choice-card-generic";
import { ClassStepRail } from "@/components/builder/class-step-rail";

function classEntry(slug: string, name: string, levels: Array<{ level: number; features: string[] }>): ContentEntry {
  return {
    id: `c-${slug}`,
    slug,
    name,
    content_type: "class",
    data: { hit_die: 10, levels },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("ClassStepRail", () => {
  function setup(overrides: Partial<Parameters<typeof ClassStepRail>[0]> = {}) {
    const handlers = {
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onSubclassSelect: vi.fn(),
      onAsiSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
    };
    const props = {
      classes: [
        classEntry("paladin", "Paladin", [
          { level: 1, features: ["divine-sense"] },
          { level: 2, features: [] },
          { level: 3, features: ["sacred-oath"] },
        ]),
      ],
      subclasses: [],
      features: [
        { id: "f1", slug: "divine-sense", name: "Divine Sense", content_type: "feature", data: { level: 1, class: "paladin" }, effects: [], version: 1, source: "srd" } as ContentEntry,
        { id: "f2", slug: "sacred-oath", name: "Sacred Oath", content_type: "feature", data: { level: 3, class: "paladin", feature_type: "subclass" }, effects: [], version: 1, source: "srd" } as ContentEntry,
      ],
      selectedClasses: [{ slug: "paladin", level: 3 }],
      localChoices: {} as CharacterChoices,
      contentRefs: [],
      ...handlers,
      ...overrides,
    };
    const utils = render(<ClassStepRail {...props} />);
    return { ...utils, ...handlers, props };
  }

  it("renders one rail per selected class and an AddClassRow", () => {
    setup();
    expect(screen.getByRole("button", { name: /level 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /level 3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add a class/i })).toBeInTheDocument();
  });

  it("starts with the highest level of the (only) class as the active level", () => {
    setup();
    // Level 3's pill should be aria-current=true.
    const lv3Pill = screen.getByRole("button", { name: /level 3/i });
    expect(lv3Pill).toHaveAttribute("aria-current", "true");
  });

  it("switches the main pane content when a different level pill is clicked", () => {
    setup();
    // Initially: Sacred Oath title (lv 3 has subclass choice).
    expect(screen.getByRole("heading", { level: 2, name: "Sacred Oath" })).toBeInTheDocument();
    // Click Lv 1 → title becomes "Divine Sense".
    fireEvent.click(screen.getByRole("button", { name: /level 1/i }));
    expect(screen.getByRole("heading", { level: 2, name: "Divine Sense" })).toBeInTheDocument();
  });

  it("forwards onLevelChange with the right classIndex when the level dropdown changes", () => {
    const { onLevelChange } = setup();
    fireEvent.change(screen.getByLabelText("Set level for Paladin"), { target: { value: "5" } });
    expect(onLevelChange).toHaveBeenCalledWith(0, 5);
  });

  it("renders multiple class sections for a multiclass character", () => {
    setup({
      classes: [
        classEntry("barbarian", "Barbarian", [{ level: 1, features: [] }]),
        classEntry("fighter", "Fighter", [{ level: 1, features: [] }]),
      ],
      selectedClasses: [
        { slug: "barbarian", level: 10 },
        { slug: "fighter", level: 5 },
      ],
    });
    expect(screen.getByText("Barbarian")).toBeInTheDocument();
    expect(screen.getByText("Fighter")).toBeInTheDocument();
  });
});

function setupRail(overrides: Partial<Parameters<typeof ClassStepRail>[0]> = {}) {
  const handlers = {
    onLevelChange: vi.fn(),
    onRemoveClass: vi.fn(),
    onSubclassSelect: vi.fn(),
    onAsiSelect: vi.fn(),
    onFightingStyleSelect: vi.fn(),
    onChoiceSelect: vi.fn(),
  };
  const props = {
    classes: [
      classEntry("paladin", "Paladin", [
        { level: 1, features: ["divine-sense"] },
        { level: 2, features: [] },
        { level: 3, features: ["sacred-oath"] },
      ]),
    ],
    subclasses: [],
    features: [
      { id: "f1", slug: "divine-sense", name: "Divine Sense", content_type: "feature", data: { level: 1, class: "paladin" }, effects: [], version: 1, source: "srd" } as ContentEntry,
      { id: "f2", slug: "sacred-oath", name: "Sacred Oath", content_type: "feature", data: { level: 3, class: "paladin", feature_type: "subclass" }, effects: [], version: 1, source: "srd" } as ContentEntry,
    ],
    selectedClasses: [{ slug: "paladin", level: 3 }],
    localChoices: {} as CharacterChoices,
    contentRefs: [],
    ...handlers,
    ...overrides,
  };
  const utils = render(<ClassStepRail {...props} />);
  return { ...utils, ...handlers, props };
}

describe("ChoiceCardGeneric", () => {
  it("shows 'Choose' when no selections, 'Chosen' when at max", () => {
    const choiceEffect = {
      type: "choice" as const,
      choice_id: "wizard-skills",
      grant_type: "skill",
      choose: 2,
      from: ["arcana", "history", "investigation"],
    };
    const { rerender } = render(
      <ChoiceCardGeneric
        choiceEffect={choiceEffect}
        currentSelections={[]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Choose")).toBeInTheDocument();
    rerender(
      <ChoiceCardGeneric
        choiceEffect={choiceEffect}
        currentSelections={["arcana", "history"]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Chosen")).toBeInTheDocument();
  });
});

describe("ClassStepRail — Remove Class button", () => {
  it("renders a Remove button per class", () => {
    setupRail();
    expect(screen.getByRole("button", { name: /Remove Paladin/i })).toBeInTheDocument();
  });

  it("calls onRemoveClass with the class index when confirmed", () => {
    const onRemoveClass = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    setupRail({ onRemoveClass });
    fireEvent.click(screen.getByRole("button", { name: /Remove Paladin/i }));
    expect(onRemoveClass).toHaveBeenCalledWith(0);
  });

  it("does not call onRemoveClass when the confirm is cancelled", () => {
    const onRemoveClass = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    setupRail({ onRemoveClass });
    fireEvent.click(screen.getByRole("button", { name: /Remove Paladin/i }));
    expect(onRemoveClass).not.toHaveBeenCalled();
  });
});

import { ClassPickerCard } from "@/components/builder/class-step-rail/class-picker-card";
import type { ClassPrereqResult } from "@/lib/builder/multiclass-prereqs";

function pickerClass(slug: string, name: string, data: Record<string, unknown> = {}): ContentEntry {
  return {
    id: `c-${slug}`,
    slug,
    name,
    content_type: "class",
    data,
    effects: [],
    version: 1,
    source: "srd",
  };
}

function prereq(state: ClassPrereqResult["state"], line: string, classSlug = "paladin"): ClassPrereqResult {
  return { classSlug, state, line };
}

describe("ClassPickerCard", () => {
  it("renders emblem letter, class name, and prereq line for met state", () => {
    render(
      <ClassPickerCard
        classContent={pickerClass("paladin", "Paladin", { role: "Defender / Striker" })}
        prereq={prereq("met", "STR 13 · met")}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Paladin")).toBeInTheDocument();
    expect(screen.getByText(/Defender \/ Striker/i)).toBeInTheDocument();
    expect(screen.getByText("STR 13 · met")).toBeInTheDocument();
  });

  it("falls back to a derived role string when classContent.data.role is absent", () => {
    render(
      <ClassPickerCard
        classContent={pickerClass("rogue", "Rogue", { hit_die: 8 })}
        prereq={prereq("met", "DEX 13 · met", "rogue")}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/d8 hit die/i)).toBeInTheDocument();
  });

  it("is aria-disabled and shows the unmet line for not-met state", () => {
    render(
      <ClassPickerCard
        classContent={pickerClass("wizard", "Wizard")}
        prereq={prereq("not-met", "INT 13 · not met", "wizard")}
        onSelect={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Wizard/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("INT 13 · not met")).toBeInTheDocument();
  });

  it("is aria-disabled and shows 'Already in this build' for already-in-build state", () => {
    render(
      <ClassPickerCard
        classContent={pickerClass("paladin", "Paladin")}
        prereq={prereq("already-in-build", "Already in this build")}
        onSelect={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Paladin/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Already in this build")).toBeInTheDocument();
  });

  it("calls onSelect(classContent) when met card is clicked", () => {
    const onSelect = vi.fn();
    const content = pickerClass("paladin", "Paladin");
    render(
      <ClassPickerCard
        classContent={content}
        prereq={prereq("met", "STR 13 · met")}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Paladin/i }));
    expect(onSelect).toHaveBeenCalledWith(content);
  });

  it("does not call onSelect when not-met card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ClassPickerCard
        classContent={pickerClass("wizard", "Wizard")}
        prereq={prereq("not-met", "INT 13 · not met", "wizard")}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Wizard/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not call onSelect when already-in-build card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ClassPickerCard
        classContent={pickerClass("paladin", "Paladin")}
        prereq={prereq("already-in-build", "Already in this build")}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Paladin/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";

const TWELVE_CLASSES: ContentEntry[] = [
  "barbarian", "bard", "cleric", "druid", "fighter", "monk",
  "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
].map((slug) => pickerClass(slug, slug.charAt(0).toUpperCase() + slug.slice(1)));

describe("ClassPickerPanel", () => {
  const stats = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 13, wisdom: 13, charisma: 13,
  };

  it("renders one card per class in the input list", () => {
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    for (const slug of ["barbarian", "wizard", "paladin", "fighter"]) {
      const name = slug.charAt(0).toUpperCase() + slug.slice(1);
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it("renders the heading and a Cancel button", () => {
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={17}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByText(/17 levels remaining/i)).toBeInTheDocument();
  });

  it("Cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("clicking a met card calls onSelect with that class content", () => {
    const onSelect = vi.fn();
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Paladin/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].slug).toBe("paladin");
  });

  it("clicking a not-met card does not call onSelect", () => {
    const onSelect = vi.fn();
    const lowStats = {
      strength: 8, dexterity: 8, constitution: 8,
      intelligence: 8, wisdom: 8, charisma: 8,
    };
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={lowStats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Paladin/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks already-selected classes as already-in-build", () => {
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[{ slug: "paladin" }]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Already in this build/i)).toBeInTheDocument();
  });
});
