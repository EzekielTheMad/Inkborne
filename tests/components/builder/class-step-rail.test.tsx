import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import { CharacterStrip } from "@/components/builder/class-step-rail/character-strip";
import { LevelRailSetLevelSheet } from "@/components/builder/class-step-rail/level-rail-set-level-sheet";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, HpRollRecord } from "@/lib/types/character";

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
        onLevelUpClick={vi.fn()}
        levelUpButtonState="idle"
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
        onLevelUpClick={vi.fn()}
        levelUpButtonState="idle"
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
        onLevelUpClick={vi.fn()}
        levelUpButtonState="idle"
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
        onLevelUpClick={vi.fn()}
        levelUpButtonState="idle"
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
  isPrimaryClass: true,
  hitDie: 8,
  hpRule: "free_choice" as const,
  conMod: 0,
  hpRolls: {} as Record<string, HpRollRecord>,
  onAsiSelect: vi.fn(),
  onSubclassSelect: vi.fn(),
  onFightingStyleSelect: vi.fn(),
  onChoiceSelect: vi.fn(),
  onHpRollChange: vi.fn(),
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
      onConfirmLevelUp: vi.fn(),
      onCancelLevelUp: vi.fn(),
      onHpRollChange: vi.fn(),
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
      resolvedStats: {
        strength: 10, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10,
      },
      hpRule: "free_choice" as const,
      hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
      onAddClass: vi.fn(),
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
    onConfirmLevelUp: vi.fn(),
    onCancelLevelUp: vi.fn(),
    onHpRollChange: vi.fn(),
    onAddClass: vi.fn(),
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
    resolvedStats: {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    },
    hpRule: "free_choice" as const,
    hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
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

describe("ClassStepRail — multiclass picker", () => {
  function setupForPicker(overrides: Partial<Parameters<typeof ClassStepRail>[0]> = {}) {
    const handlers = {
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onSubclassSelect: vi.fn(),
      onAsiSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
      onAddClass: vi.fn(),
      onConfirmLevelUp: vi.fn(),
      onCancelLevelUp: vi.fn(),
      onHpRollChange: vi.fn(),
    };
    const allClasses = [
      "barbarian", "bard", "cleric", "druid", "fighter", "monk",
      "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
    ].map((slug) =>
      classEntry(slug, slug.charAt(0).toUpperCase() + slug.slice(1), [
        { level: 1, features: [] },
      ]),
    );
    const props = {
      classes: allClasses,
      subclasses: [],
      features: [],
      selectedClasses: [{ slug: "paladin", level: 3 }],
      localChoices: {} as CharacterChoices,
      resolvedStats: {
        strength: 13, dexterity: 12, constitution: 14,
        intelligence: 8, wisdom: 10, charisma: 13,
      },
      hpRule: "free_choice" as const,
      hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
      ...handlers,
      ...overrides,
    };
    const utils = render(<ClassStepRail {...props} />);
    return { ...utils, ...handlers, props };
  }

  it("renders the locked AddClassRow when no class qualifies", () => {
    setupForPicker({
      resolvedStats: {
        strength: 8, dexterity: 8, constitution: 8,
        intelligence: 8, wisdom: 8, charisma: 8,
      },
    });
    expect(screen.getByText(/Add a class · Locked/i)).toBeInTheDocument();
  });

  it("renders the unlocked AddClassRow when at least one class qualifies", () => {
    setupForPicker();
    expect(screen.getByText(/Add a class · 17 levels remaining/i)).toBeInTheDocument();
  });

  it("opens the ClassPickerPanel when the unlocked AddClassRow is clicked", () => {
    setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
  });

  it("closes the picker when its Cancel button is clicked", () => {
    setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByRole("heading", { level: 2, name: /Add a class/i })).not.toBeInTheDocument();
  });

  it("calls onAddClass when a met card in the picker is clicked", () => {
    const { onAddClass } = setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    fireEvent.click(screen.getByRole("button", { name: /Barbarian/i }));
    expect(onAddClass).toHaveBeenCalledTimes(1);
    expect(onAddClass.mock.calls[0][0].slug).toBe("barbarian");
  });

  it("does not auto-close the picker when onAddClass is invoked (modal will close it via length increment)", () => {
    setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    fireEvent.click(screen.getByRole("button", { name: /Barbarian/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
  });

  it("closes the picker when selectedClasses.length increments (simulated Pick)", () => {
    const { rerender, props } = setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();

    rerender(
      <ClassStepRail
        {...props}
        selectedClasses={[
          { slug: "paladin", level: 3 },
          { slug: "barbarian", level: 1 },
        ]}
      />,
    );
    expect(screen.queryByRole("heading", { level: 2, name: /Add a class/i })).not.toBeInTheDocument();
  });

  it("locks AddClassRow when totalLevel reaches 20", () => {
    setupForPicker({
      selectedClasses: [{ slug: "paladin", level: 20 }],
    });
    expect(screen.getByText(/Add a class · Locked/i)).toBeInTheDocument();
  });
});

import { LevelUpButton } from "@/components/builder/class-step-rail/level-up-button";

describe("LevelUpButton", () => {
  it("renders idle state with 'Level up [Class]' label and 'Lv {N+1}' glyph", () => {
    render(
      <LevelUpButton state="idle" classSlug="paladin" classLabel="Paladin" atLevel={6} onClick={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Level up Paladin to level 7/i })).toBeInTheDocument();
    expect(screen.getByText(/Lv 7/i)).toBeInTheDocument();
  });

  it("idle state is not aria-disabled and click fires onClick", () => {
    const onClick = vi.fn();
    render(
      <LevelUpButton state="idle" classSlug="paladin" classLabel="Paladin" atLevel={6} onClick={onClick} />,
    );
    const btn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(btn).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled-with-reason state renders reason text + aria-disabled true; click is no-op", () => {
    const onClick = vi.fn();
    render(
      <LevelUpButton
        state="disabled"
        classSlug="paladin"
        classLabel="Paladin"
        atLevel={6}
        reason="Finish Pal 7 first"
        onClick={onClick}
      />,
    );
    const btn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Finish Pal 7 first/i)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("active-flow state renders 'In progress' reason and is aria-disabled", () => {
    render(
      <LevelUpButton
        state="active-flow"
        classSlug="paladin"
        classLabel="Paladin"
        atLevel={6}
        onClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/In progress/i)).toBeInTheDocument();
  });

  it("tone-codes by class slug (gold for martial, purple for caster) via classTone()", () => {
    const { rerender } = render(
      <LevelUpButton state="idle" classSlug="paladin" classLabel="Paladin" atLevel={1} onClick={vi.fn()} />,
    );
    const goldBtn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(goldBtn).toHaveAttribute("data-tone", "gold");

    rerender(
      <LevelUpButton state="idle" classSlug="wizard" classLabel="Wizard" atLevel={1} onClick={vi.fn()} />,
    );
    const purpleBtn = screen.getByRole("button", { name: /Level up Wizard/i });
    expect(purpleBtn).toHaveAttribute("data-tone", "purple");
  });
});

import { HpPicker } from "@/components/builder/class-step-rail/hp-picker";

describe("HpPicker", () => {
  function defaults(overrides: Partial<Parameters<typeof HpPicker>[0]> = {}) {
    return {
      classSlug: "paladin",
      level: 2,
      hitDie: 10,
      conMod: 2,
      isFirstLevelOfPrimary: false,
      hpRule: "free_choice" as const,
      storedRoll: undefined as HpRollRecord | undefined,
      onChange: vi.fn(),
      ...overrides,
    };
  }

  it("does not render when isFirstLevelOfPrimary is true", () => {
    const { container } = render(<HpPicker {...defaults({ isFirstLevelOfPrimary: true })} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all three method buttons under free_choice", () => {
    render(<HpPicker {...defaults()} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Roll d10/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Manual/i })).toBeInTheDocument();
  });

  it("Average button shows displayed value avg + conMod (d10 + CON 2 → +8)", () => {
    render(<HpPicker {...defaults()} />);
    expect(screen.getByRole("radio", { name: /Average.*\+8/i })).toBeInTheDocument();
  });

  it("clicking Average calls onChange with raw die contribution (no conMod)", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Average/i }));
    expect(onChange).toHaveBeenCalledWith({ method: "average", value: 6 });
  });

  it("clicking Roll d{die} writes a roll in [1, die]", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Roll d10/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const record = onChange.mock.calls[0][0] as HpRollRecord;
    expect(record.method).toBe("rolled");
    expect(record.value).toBeGreaterThanOrEqual(1);
    expect(record.value).toBeLessThanOrEqual(10);
  });

  it("re-clicking Roll re-rolls (overwrites stored value)", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Roll d10/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Roll d10/i }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("clicking Manual reveals a numeric input and onChange fires on Enter", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Manual/i }));
    const input = screen.getByLabelText("Manual HP value");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ method: "manual", value: 7 });
  });

  it("Manual input out-of-range (0 or > die) does not fire onChange", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Manual/i }));
    const input = screen.getByLabelText("Manual HP value");
    fireEvent.change(input, { target: { value: "11" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rendered method shows aria-checked on the right radio when storedRoll is present", () => {
    render(<HpPicker {...defaults({ storedRoll: { method: "rolled", value: 8 } })} />);
    const rollBtn = screen.getByRole("radio", { name: /Roll d10/i });
    expect(rollBtn).toHaveAttribute("aria-checked", "true");
  });

  it("rolled_only rule renders only the Roll button + read-only display when no roll yet", () => {
    render(<HpPicker {...defaults({ hpRule: "rolled_only" })} />);
    expect(screen.queryByRole("radio", { name: /Average/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Manual/i })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Roll d10/i })).toBeInTheDocument();
  });

  it("average_only rule renders read-only display, no interactive radios", () => {
    const { container } = render(<HpPicker {...defaults({ hpRule: "average_only" })} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/Campaign rule: Average/i)).toBeInTheDocument();
    expect(container.textContent).toContain("+8");
  });

  it("max_for_all rule renders read-only display showing max + conMod", () => {
    const { container } = render(<HpPicker {...defaults({ hpRule: "max_for_all" })} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/Campaign rule: Max/i)).toBeInTheDocument();
    expect(container.textContent).toContain("+12");
  });

  it("max_first_level_each_class at level 1 of any class renders read-only display", () => {
    render(<HpPicker {...defaults({ hpRule: "max_first_level_each_class", level: 1 })} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/First level of class.*Max/i)).toBeInTheDocument();
  });

  it("max_first_level_each_class at level > 1 renders the full free_choice picker", () => {
    render(<HpPicker {...defaults({ hpRule: "max_first_level_each_class", level: 5 })} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Roll d10/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Manual/i })).toBeInTheDocument();
  });
});

import { LevelUpActionBar } from "@/components/builder/class-step-rail/level-up-action-bar";
import { LevelUpPane } from "@/components/builder/class-step-rail/level-up-pane";

describe("LevelUpActionBar", () => {
  function defaults(overrides: Partial<Parameters<typeof LevelUpActionBar>[0]> = {}) {
    return {
      classLabel: "Paladin",
      draftLevel: 7,
      totalLevelAfterConfirm: 10,
      canConfirm: true,
      missingReason: "",
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
      ...overrides,
    };
  }

  it("renders Cancel button + summary text + Confirm button", () => {
    render(<LevelUpActionBar {...defaults()} />);
    expect(screen.getByRole("button", { name: /Cancel level-up/i })).toBeInTheDocument();
    expect(screen.getByText(/Will set Paladin to Lv 7/i)).toBeInTheDocument();
    expect(screen.getByText(/character to Lv 10/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeInTheDocument();
  });

  it("Confirm is disabled and aria-describedby points to missingReason when canConfirm is false", () => {
    render(<LevelUpActionBar {...defaults({ canConfirm: false, missingReason: "Pick a subclass to enable Confirm" })} />);
    const confirm = screen.getByRole("button", { name: /Confirm level 7/i });
    expect(confirm).toBeDisabled();
    const describedById = confirm.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById!)?.textContent).toMatch(/Pick a subclass/i);
  });

  it("Confirm is enabled when canConfirm is true and onConfirm fires", () => {
    const onConfirm = vi.fn();
    render(<LevelUpActionBar {...defaults({ onConfirm })} />);
    fireEvent.click(screen.getByRole("button", { name: /Confirm level 7/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(<LevelUpActionBar {...defaults({ onCancel })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel level-up/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("LevelUpPane", () => {
  function classEntryWithHitDie(slug: string, name: string, hitDie: number, levels: Array<{ level: number; features: string[] }>): ContentEntry {
    return {
      id: `c-${slug}`,
      slug,
      name,
      content_type: "class",
      data: { hit_die: hitDie, levels },
      effects: [],
      version: 1,
      source: "srd",
    };
  }

  function passiveLevelRow(level: number, featureSlug: string, featureName: string): PerLevel {
    return {
      level,
      features: [
        {
          id: `f-${featureSlug}`,
          slug: featureSlug,
          name: featureName,
          content_type: "feature",
          data: { level, class: "paladin", description: "Your aura range increases." },
          effects: [],
          version: 1,
          source: "srd",
        },
      ],
      choices: [],
    };
  }

  function defaults(overrides: Partial<Parameters<typeof LevelUpPane>[0]> = {}) {
    return {
      classContent: classEntryWithHitDie("paladin", "Paladin", 10, [
        { level: 7, features: ["aura-improvement"] },
      ]),
      classIndex: 0,
      isPrimaryClass: true,
      draftLevel: 7,
      totalLevelAfterConfirm: 10,
      perLevelRow: passiveLevelRow(7, "aura-improvement", "Aura improvement"),
      subclasses: [] as ContentEntry[],
      styleOptions: [] as ContentEntry[],
      localChoices: {} as CharacterChoices,
      currentSubclass: undefined as string | undefined,
      classChoices: [] as Array<import("@/lib/types/effects").ChoiceEffect>,
      hpRule: "free_choice" as const,
      conMod: 2,
      hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
      onAsiSelect: vi.fn(),
      onSubclassSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
      onHpRollChange: vi.fn(),
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
      ...overrides,
    };
  }

  it("renders the breadcrumb with class name and draft level + NEW LEVEL ribbon", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByText("Paladin")).toBeInTheDocument();
    expect(screen.getByText("Level 7")).toBeInTheDocument();
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });

  it("renders the heading from the level row's first feature name", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByRole("heading", { level: 2, name: /Aura improvement/i })).toBeInTheDocument();
  });

  it("renders 'What this level grants' feature cards section", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByText(/What this level grants/i)).toBeInTheDocument();
  });

  it("renders 'Choices for this level' section ONLY when row has choices", () => {
    const { rerender } = render(<LevelUpPane {...defaults()} />);
    expect(screen.queryByText(/Choices for this level/i)).not.toBeInTheDocument();

    const rowWithChoice: PerLevel = {
      level: 3,
      features: [],
      choices: [
        { type: "subclass", classSlug: "paladin", label: "Sacred Oath", isMade: false },
      ],
    };
    rerender(<LevelUpPane {...defaults({ draftLevel: 3, perLevelRow: rowWithChoice })} />);
    expect(screen.getByText(/Choices for this level/i)).toBeInTheDocument();
  });

  it("renders the HP picker for non-Lv1-primary draft levels", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
  });

  it("does NOT render the HP picker when draft is Lv1 of primary class", () => {
    render(<LevelUpPane {...defaults({ draftLevel: 1, isPrimaryClass: true })} />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("Confirm is disabled when there is an unmade required choice", () => {
    const rowWithUnmadeChoice: PerLevel = {
      level: 3,
      features: [],
      choices: [
        { type: "subclass", classSlug: "paladin", label: "Sacred Oath", isMade: false },
      ],
    };
    render(<LevelUpPane {...defaults({ draftLevel: 3, perLevelRow: rowWithUnmadeChoice })} />);
    expect(screen.getByRole("button", { name: /Confirm level 3/i })).toBeDisabled();
  });

  it("Confirm is disabled when HP is unset (free_choice, non-Lv1-primary)", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeDisabled();
  });

  it("Confirm is enabled when all choices made + HP set", () => {
    const hpRolls = { "paladin-7": { method: "average" as const, value: 6 } };
    render(<LevelUpPane {...defaults({ hpRolls })} />);
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeEnabled();
  });

  it("clicking Cancel calls onCancel", () => {
    const onCancel = vi.fn();
    render(<LevelUpPane {...defaults({ onCancel })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel level-up/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking HP picker Average fires onHpRollChange with the right key", () => {
    const onHpRollChange = vi.fn();
    render(<LevelUpPane {...defaults({ onHpRollChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Average/i }));
    expect(onHpRollChange).toHaveBeenCalledWith("paladin-7", { method: "average", value: 6 });
  });

  it("does not render description paragraph when no feature has a description field", () => {
    const rowWithoutDescription: PerLevel = {
      level: 7,
      features: [
        {
          id: "f-aura-imp",
          slug: "aura-improvement",
          name: "Aura improvement",
          content_type: "feature",
          data: { level: 7, class: "paladin" }, // no description field
          effects: [],
          version: 1,
          source: "srd",
        },
      ],
      choices: [],
    };
    render(<LevelUpPane {...defaults({ perLevelRow: rowWithoutDescription })} />);
    // Heading still present
    expect(screen.getByRole("heading", { level: 2, name: /Aura improvement/i })).toBeInTheDocument();
    // No description paragraph (the `<p>` would render the description text directly).
    // The "What this level grants" eyebrow IS rendered, so we can't just check for
    // *no* paragraphs. Instead, we check that no element contains the description text.
    expect(screen.queryByText(/aura range increases/i)).not.toBeInTheDocument();
  });
});

describe("ClassLevelPane — HP picker retrofit", () => {
  function defaults(overrides: Partial<Parameters<typeof ClassLevelPane>[0]> = {}) {
    return {
      classSlug: "paladin",
      className_: "Paladin",
      classIndex: 0,
      isPrimaryClass: true,
      row: { level: 3, features: [], choices: [] } as PerLevel,
      subclasses: [] as ContentEntry[],
      styleOptions: [] as ContentEntry[],
      localChoices: {} as CharacterChoices,
      currentSubclass: undefined as string | undefined,
      classChoices: [] as Array<import("@/lib/types/effects").ChoiceEffect>,
      hitDie: 10,
      hpRule: "free_choice" as const,
      conMod: 2,
      hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
      onAsiSelect: vi.fn(),
      onSubclassSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
      onHpRollChange: vi.fn(),
      ...overrides,
    };
  }

  it("renders the HP picker for non-Lv1-primary levels", () => {
    render(<ClassLevelPane {...defaults({ row: { level: 5, features: [], choices: [] } })} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
  });

  it("does NOT render the HP picker for Lv1 of primary class", () => {
    render(<ClassLevelPane {...defaults({ row: { level: 1, features: [], choices: [] }, isPrimaryClass: true })} />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("renders HP picker for Lv1 of non-primary class (multiclass first level)", () => {
    render(<ClassLevelPane {...defaults({ row: { level: 1, features: [], choices: [] }, isPrimaryClass: false })} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
  });

  it("clicking the HP picker fires onHpRollChange with the right key", () => {
    const onHpRollChange = vi.fn();
    render(<ClassLevelPane {...defaults({ row: { level: 5, features: [], choices: [] }, onHpRollChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Average/i }));
    expect(onHpRollChange).toHaveBeenCalledWith("paladin-5", { method: "average", value: 6 });
  });
});

describe("ClassLevelPane — empty-state polish", () => {
  it("shows a friendly empty-state when row has no features and no choices", () => {
    render(
      <ClassLevelPane
        classSlug="wizard"
        className_="Wizard"
        classIndex={0}
        isPrimaryClass={true}
        row={{ level: 3, features: [], choices: [] }}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{} as CharacterChoices}
        currentSubclass={undefined}
        classChoices={[]}
        hitDie={6}
        hpRule="free_choice"
        conMod={1}
        hpRolls={{}}
        onAsiSelect={vi.fn()}
        onSubclassSelect={vi.fn()}
        onFightingStyleSelect={vi.fn()}
        onChoiceSelect={vi.fn()}
        onHpRollChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/No new features at this level/i)).toBeInTheDocument();
    expect(screen.queryByText(/No class data for the selected level/i)).not.toBeInTheDocument();
  });
});

describe("LevelRail — disabled mid-flow + LevelUpButton", () => {
  function defaults(overrides: Partial<Parameters<typeof LevelRail>[0]> = {}) {
    return {
      classSlug: "paladin",
      className_: "Paladin",
      subclassName: undefined,
      currentLevel: 6,
      perLevel: makePerLevel(),
      activeLevel: 6,
      onSelectLevel: vi.fn(),
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onLevelUpClick: vi.fn(),
      levelUpButtonState: "idle" as const,
      levelUpButtonReason: undefined,
      disabled: false,
      ...overrides,
    };
  }

  it("renders a LevelUpButton tile beneath the level pills (idle state)", () => {
    render(<LevelRail {...defaults()} />);
    expect(screen.getByRole("button", { name: /Level up Paladin/i })).toBeInTheDocument();
  });

  it("clicking the idle LevelUpButton fires onLevelUpClick", () => {
    const onLevelUpClick = vi.fn();
    render(<LevelRail {...defaults({ onLevelUpClick })} />);
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin/i }));
    expect(onLevelUpClick).toHaveBeenCalledTimes(1);
  });

  it("disables level dropdown + Remove button when disabled prop is true", () => {
    render(<LevelRail {...defaults({ disabled: true })} />);
    expect(screen.getByLabelText("Set level for Paladin")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Remove Paladin/i })).toBeDisabled();
  });

  it("renders LevelUpButton in active-flow state when levelUpButtonState='active-flow'", () => {
    render(<LevelRail {...defaults({ levelUpButtonState: "active-flow" })} />);
    expect(screen.getByText(/In progress/i)).toBeInTheDocument();
  });

  it("renders LevelUpButton in disabled state with the provided reason", () => {
    render(<LevelRail {...defaults({ levelUpButtonState: "disabled", levelUpButtonReason: "Finish Pal 7 first" })} />);
    expect(screen.getByText(/Finish Pal 7 first/i)).toBeInTheDocument();
  });
});

describe("AddClassRow — disabledReason override", () => {
  it("renders the provided disabledReason instead of the default reasons list", () => {
    render(<AddClassRow reasons={["Requires CHA 13 for Bard"]} disabledReason="Finish active level-up first" />);
    expect(screen.getByText(/Finish active level-up first/i)).toBeInTheDocument();
    expect(screen.queryByText(/Requires CHA 13 for Bard/i)).not.toBeInTheDocument();
  });

  it("falls back to reasons list when disabledReason is undefined (locked variant)", () => {
    render(<AddClassRow reasons={["Requires CHA 13 for Bard"]} />);
    expect(screen.getByText(/Requires CHA 13 for Bard/i)).toBeInTheDocument();
  });
});

describe("ClassStepRail — level-up flow", () => {
  function setupForLevelUp(overrides: Partial<Parameters<typeof ClassStepRail>[0]> = {}) {
    const handlers = {
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onSubclassSelect: vi.fn(),
      onAsiSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
      onAddClass: vi.fn(),
      onConfirmLevelUp: vi.fn(),
      onCancelLevelUp: vi.fn(),
      onHpRollChange: vi.fn(),
    };
    const allClasses = ["paladin", "wizard", "fighter"].map((slug) =>
      classEntry(slug, slug.charAt(0).toUpperCase() + slug.slice(1), [
        { level: 1, features: [] },
        { level: 2, features: [] },
        { level: 3, features: [] },
        { level: 4, features: [] },
        { level: 5, features: [] },
        { level: 6, features: [] },
        { level: 7, features: ["aura-improvement"] },
      ]),
    );
    const props = {
      classes: allClasses,
      subclasses: [],
      features: [
        { id: "f-aura-imp", slug: "aura-improvement", name: "Aura improvement", content_type: "feature", data: { level: 7, class: "paladin", description: "Your aura range increases." }, effects: [], version: 1, source: "srd" } as ContentEntry,
      ],
      selectedClasses: [
        { slug: "paladin", level: 6 },
        { slug: "wizard", level: 3 },
      ],
      localChoices: {} as CharacterChoices,
      resolvedStats: {
        strength: 14, dexterity: 12, constitution: 14,
        intelligence: 13, wisdom: 10, charisma: 14,
      },
      hpRule: "free_choice" as const,
      hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
      ...handlers,
      ...overrides,
    };
    const utils = render(<ClassStepRail {...props} />);
    return { ...utils, ...handlers, props };
  }

  it("renders a LevelUpButton tile per class section in idle state by default", () => {
    setupForLevelUp();
    expect(screen.getByRole("button", { name: /Level up Paladin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Level up Wizard/i })).toBeInTheDocument();
  });

  it("clicking idle LevelUpButton opens the LevelUpPane in main pane", () => {
    setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Aura improvement/i })).toBeInTheDocument();
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });

  it("opening flow disables ALL other rail mutators (hard lock)", () => {
    setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    // Other class's LevelUpButton: disabled with reason
    const wizardBtn = screen.getByRole("button", { name: /Level up Wizard/i });
    expect(wizardBtn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText(/Finish Paladin 7 first/i).length).toBeGreaterThan(0);
    // All level dropdowns: disabled
    expect(screen.getByLabelText("Set level for Paladin")).toBeDisabled();
    expect(screen.getByLabelText("Set level for Wizard")).toBeDisabled();
    // All Remove buttons: disabled
    expect(screen.getByRole("button", { name: /Remove Paladin/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Remove Wizard/i })).toBeDisabled();
  });

  it("AddClassRow shows 'Finish active level-up first' during flow", () => {
    setupForLevelUp({
      resolvedStats: { strength: 14, dexterity: 14, constitution: 14, intelligence: 14, wisdom: 14, charisma: 14 },
    });
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    expect(screen.getByText(/Finish active level-up first/i)).toBeInTheDocument();
  });

  it("clicking 'Cancel level-up' returns to ClassLevelPane and re-enables the rail", () => {
    setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel level-up/i }));
    expect(screen.queryByText(/NEW LEVEL/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Set level for Paladin")).not.toBeDisabled();
  });

  it("clicking Confirm fires onConfirmLevelUp with the right payload", () => {
    const { onConfirmLevelUp, onHpRollChange } = setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    // Pick HP first (no choices at Paladin Lv 7 — passive level)
    fireEvent.click(screen.getByRole("radio", { name: /Average/i }));
    expect(onHpRollChange).toHaveBeenCalledWith("paladin-7", { method: "average", value: 6 });
    // Now Confirm should be enabled
    const confirmBtn = screen.getByRole("button", { name: /Confirm level 7/i });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(onConfirmLevelUp).toHaveBeenCalledWith({ classIndex: 0, draftLevel: 7 });
  });

  it("clears the draft when selectedClasses[i].level increments via rerender (parent confirm)", () => {
    const { rerender, props } = setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();

    // Simulate parent persisting the new level — selectedClasses[0].level goes 6 -> 7.
    const newSelectedClasses = [
      { slug: "paladin", level: 7 },
      ...props.selectedClasses.slice(1),
    ];
    rerender(<ClassStepRail {...props} selectedClasses={newSelectedClasses} />);

    // Draft cleared: NEW LEVEL ribbon is gone.
    expect(screen.queryByText(/NEW LEVEL/i)).not.toBeInTheDocument();
    // Rail re-enabled: dropdown no longer disabled.
    expect(screen.getByLabelText("Set level for Paladin")).not.toBeDisabled();
  });

  it("opening flow closes the multiclass picker if it was open", () => {
    setupForLevelUp({
      resolvedStats: { strength: 14, dexterity: 14, constitution: 14, intelligence: 14, wisdom: 14, charisma: 14 },
    });
    // Open picker first
    fireEvent.click(screen.getByRole("button", { name: /Add a class/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
    // Now open level-up flow
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    // Picker should be closed
    expect(screen.queryByRole("heading", { level: 2, name: /Add a class/i })).not.toBeInTheDocument();
    // Level-up pane should be open
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });
});

describe("CharacterStrip", () => {
  function classEntry(slug: string, name: string): ContentEntry {
    return {
      id: `c-${slug}`,
      slug,
      name,
      content_type: "class",
      data: {},
      effects: [],
      version: 1,
      source: "srd",
    };
  }

  function defaults(overrides: Partial<Parameters<typeof CharacterStrip>[0]> = {}) {
    return {
      characterName: "Kaelith Vex",
      totalLevel: 9,
      maxLevel: 20,
      classes: [classEntry("paladin", "Paladin"), classEntry("sorcerer", "Sorcerer")],
      selectedClasses: [
        { slug: "paladin", level: 6 },
        { slug: "sorcerer", level: 3 },
      ],
      ...overrides,
    };
  }

  it("renders avatar with character initials", () => {
    render(<CharacterStrip {...defaults()} />);
    expect(screen.getByText("KV")).toBeInTheDocument();
  });

  it("renders character name and level summary", () => {
    render(<CharacterStrip {...defaults()} />);
    expect(screen.getByText("Kaelith Vex")).toBeInTheDocument();
    expect(screen.getByText(/Lv 9\/20/i)).toBeInTheDocument();
  });

  it("renders one chip badge per class with class letter and tabular level", () => {
    const { container } = render(<CharacterStrip {...defaults()} />);
    expect(container.querySelectorAll('[data-slot="class-emblem"]').length).toBeGreaterThanOrEqual(2);
    // Level numbers visible
    expect(container.textContent).toContain("6");
    expect(container.textContent).toContain("3");
  });

  it("returns null when selectedClasses.length <= 1", () => {
    const { container } = render(
      <CharacterStrip
        {...defaults({
          selectedClasses: [{ slug: "paladin", level: 6 }],
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("region has aria-label='Character summary'", () => {
    render(<CharacterStrip {...defaults()} />);
    expect(screen.getByRole("region", { name: "Character summary" })).toBeInTheDocument();
  });
});

describe("LevelRailSetLevelSheet", () => {
  function defaults(overrides: Partial<Parameters<typeof LevelRailSetLevelSheet>[0]> = {}) {
    return {
      open: true,
      onOpenChange: vi.fn(),
      classSlug: "paladin",
      className_: "Paladin",
      classIndex: 0,
      currentLevel: 6,
      maxLevel: 20,
      onLevelChange: vi.fn(),
      ...overrides,
    };
  }

  it("renders sheet with title 'Set level for {Class}'", () => {
    render(<LevelRailSetLevelSheet {...defaults()} />);
    expect(screen.getByRole("heading", { name: /Set level for Paladin/i })).toBeInTheDocument();
  });

  it("renders a level select with options 1..maxLevel", () => {
    render(<LevelRailSetLevelSheet {...defaults({ maxLevel: 5 })} />);
    const select = screen.getByLabelText("Set level for Paladin");
    const options = select.querySelectorAll("option");
    expect(options.length).toBe(5);
    expect(options[0]).toHaveValue("1");
    expect(options[4]).toHaveValue("5");
  });

  it("default-selects the currentLevel", () => {
    render(<LevelRailSetLevelSheet {...defaults({ currentLevel: 3 })} />);
    const select = screen.getByLabelText("Set level for Paladin") as HTMLSelectElement;
    expect(select.value).toBe("3");
  });

  it("Confirm button fires onLevelChange with classIndex and new level", () => {
    const onLevelChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<LevelRailSetLevelSheet {...defaults({ onLevelChange, onOpenChange, classIndex: 1 })} />);
    const select = screen.getByLabelText("Set level for Paladin");
    fireEvent.change(select, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    expect(onLevelChange).toHaveBeenCalledWith(1, 8);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cancel button closes without firing onLevelChange", () => {
    const onLevelChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<LevelRailSetLevelSheet {...defaults({ onLevelChange, onOpenChange })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onLevelChange).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ClassPickerPanel — chrome prop", () => {
  const stats = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 13, wisdom: 13, charisma: 13,
  };
  const oneClass: ContentEntry[] = [pickerClass("paladin", "Paladin")];

  it("default chrome renders the heading and description", () => {
    render(
      <ClassPickerPanel
        classes={oneClass}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
    expect(screen.getByText(/levels remaining/i)).toBeInTheDocument();
  });

  it("chrome='embedded' hides the heading and description", () => {
    render(
      <ClassPickerPanel
        classes={oneClass}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        chrome="embedded"
      />,
    );
    expect(screen.queryByRole("heading", { level: 2, name: /Add a class/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/levels remaining/i)).not.toBeInTheDocument();
  });

  it("chrome='embedded' still renders the cards", () => {
    render(
      <ClassPickerPanel
        classes={oneClass}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        chrome="embedded"
      />,
    );
    expect(screen.getByRole("button", { name: /Paladin/i })).toBeInTheDocument();
  });

  it("chrome='embedded' still renders the Cancel button", () => {
    const onCancel = vi.fn();
    render(
      <ClassPickerPanel
        classes={oneClass}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={onCancel}
        chrome="embedded"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
