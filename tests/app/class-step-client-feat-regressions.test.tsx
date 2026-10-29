import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassStepRail } from "@/components/builder/class-step-rail";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { ClassPreviewModalProps } from "@/components/builder/class-preview-modal";
import type { StatPreview } from "@/components/builder/stat-preview";
import type { CharacterChoices, UsableFeatOption } from "@/lib/types/character";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { ancestryHpFixture } from "../fixtures/ancestry-hit-points";

const mocks = vi.hoisted(() => ({
  updateCharacter: vi.fn(),
  updateCharacterAndReturn: vi.fn(),
  setCharacterAsiChoiceAction: vi.fn(),
  searchUsableFeatsAction: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}));

vi.mock("@/lib/supabase/character-client", () => ({
  updateCharacter: mocks.updateCharacter,
  updateCharacterAndReturn: mocks.updateCharacterAndReturn,
}));

vi.mock("@/lib/supabase/content-refs-client", () => ({
  insertContentRef: vi.fn(),
  removeContentRefById: vi.fn(),
}));

vi.mock("@/app/(app)/characters/[id]/builder/class/actions", () => ({
  setCharacterAsiChoiceAction: mocks.setCharacterAsiChoiceAction,
  searchUsableFeatsAction: mocks.searchUsableFeatsAction,
}));

vi.mock("@/components/builder/content-browser", () => ({
  ContentBrowser: () => null,
}));

let currentPreview!: ClassPreviewModalProps;
vi.mock("@/components/builder/class-preview-modal", () => ({
  ClassPreviewModal: (props: ClassPreviewModalProps) => { currentPreview = props; return null; },
}));

let currentStatPreview: ComponentProps<typeof StatPreview>;
vi.mock("@/components/builder/stat-preview", () => ({
  StatPreview: (props: ComponentProps<typeof StatPreview>) => { currentStatPreview = props; return null; },
}));

type RailProps = ComponentProps<typeof ClassStepRail>;
let currentRail!: RailProps;

vi.mock("@/components/builder/class-step-rail", () => ({
  ClassStepRail: (props: RailProps) => {
    currentRail = props;
    const fighter = props.selectedClasses[0];
    const feat = props.localChoices.asi_choices?.["fighter-asi-4"];

    return (
      <div>
        <output aria-label="class level">{fighter?.level ?? "none"}</output>
        <output aria-label="selected ASI feat">
          {feat?.mode === "feat" ? feat.featName : "none"}
        </output>
        <button type="button" onClick={() => props.onLevelChange(0, 3)}>
          Level down
        </button>
        <button type="button" onClick={() => props.onLevelChange(0, 4)}>
          Level up
        </button>
        <button
          type="button"
          onClick={() => props.onAsiSelect("fighter-asi-4", {
            mode: "feat",
            featId: "11111111-1111-4111-8111-111111111111",
            featVersion: 7,
            featName: "Ember Sentinel",
          })}
        >
          Choose Ember Sentinel
        </button>
      </div>
    );
  },
}));

import { ClassStepClient } from "@/app/(app)/characters/[id]/builder/class/class-step-client";

const fighter: ContentEntry = {
  id: "fighter-definition",
  slug: "fighter",
  name: "Fighter",
  content_type: "class",
  data: {},
  effects: [],
  version: 1,
  source: "srd",
};

const emberSentinel: UsableFeatOption = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ember Sentinel",
  description: "Stand watch over the last flame.",
  version: 7,
  source: "homebrew",
  scope: "personal",
  prerequisiteMet: true,
  prerequisiteReason: null,
};

function renderClient(choices: CharacterChoices, saveAction?: ComponentProps<typeof ClassStepClient>["saveAction"],
  native?: { classRolesAvailable?: boolean; action_revision?: string;
    contentRefs?: ComponentProps<typeof ClassStepClient>["contentRefs"];
    equipmentPreview?: ComponentProps<typeof ClassStepClient>["equipmentPreview"]; schema?: ComponentProps<typeof ClassStepClient>["schema"] }) {
  return render(
    <ClassStepClient
      saveAction={saveAction}
      classRolesAvailable={native?.classRolesAvailable}
      equipmentPreview={native?.equipmentPreview}
      characterId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      character={{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Tamsin",
        level: 4,
        action_revision: native?.action_revision,
        base_stats: {},
        choices,
        state: { equipped_armor: "none", shield_equipped: false },
      }}
      classes={[fighter]}
      subclasses={[]}
      features={[]}
      feats={[emberSentinel]}
      spells={[]}
      contentRefs={native?.contentRefs ?? []}
      schema={native?.schema}
    />,
  );
}

function nativeClassRefs(classes: NonNullable<CharacterChoices["classes"]>): ComponentProps<typeof ClassStepClient>["contentRefs"] {
  return classes.map((cls, index) => {
    const contentId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const controllerId = `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    return { id: controllerId, content_id: contentId, content_version: 1, context: {}, choice_source: null,
      content_definitions: { ...fighter, id: contentId, slug: cls.slug, name: cls.slug },
      class_role: { occurrence_id: cls.occurrence_id!, controller_ref_id: controllerId, content_id: contentId,
        content_version: 1, role: index === 0 ? "original" : "secondary", raw_effects: [], evaluation_effects: [],
        raw_data: {}, evaluation_data: {}, action_revision: "8" } };
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

type ClientProps = ComponentProps<typeof ClassStepClient>;
const casterChoices: CharacterChoices = { classes: [
  { slug: "warlock", level: 3, occurrence_id: "30000000-0000-4000-8000-000000000001" },
  { slug: "sorcerer", level: 3, occurrence_id: "30000000-0000-4000-8000-000000000002" },
] };
const ownSavedChoices = { ...casterChoices, resolved_choices: { "warlock-choice": ["own-pick"] } };
const laterSavedChoices = { ...ownSavedChoices, resolved_choices: { ...ownSavedChoices.resolved_choices, "sorcerer-choice": ["other-pick"] } };
const casterSpells: ContentEntry[] = ["Eldritch Blast", "Fire Bolt", "Chill Touch"].map((name, index) => ({
  ...fighter, id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, name,
  slug: name.toLowerCase().replaceAll(" ", "-"), content_type: "spell",
  data: { level: 0, classes: index === 0 ? ["warlock"] : index === 1 ? ["sorcerer"] : ["warlock", "sorcerer"] },
}));
const casterPin = (index: number, class_slug: string) => ({ content_id: casterSpells[index].id, content_version: 1, class_slug, is_prepared: false });
function casterClientProps(revision: string, saveAction: ClientProps["saveAction"], choices = casterChoices,
  selectedSpells: ClientProps["selectedSpells"] = []): ClientProps {
  const fixture = ancestryHpFixture();
  const refs = choices.classes!.map((cls, index) => {
    const id = `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const contentId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    return { ...fixture.classRef, id, content_id: contentId,
      content_definitions: { ...fixture.classRef.content_definitions, id: contentId, slug: cls.slug, name: cls.slug },
      class_role: { ...fixture.classRef.class_role!, occurrence_id: cls.occurrence_id!, controller_ref_id: id,
        content_id: contentId, action_revision: revision, role: index === 0 ? "original" as const : "secondary" as const } };
  });
  return { accountId: "50000000-0000-4000-8000-000000000001", characterId: fixture.character.id,
    character: { ...fixture.character, name: "Concurrent casters", choices, action_revision: revision,
      level: choices.classes!.reduce((sum, cls) => sum + cls.level, 0) },
    classes: refs.map(ref => ref.content_definitions), subclasses: [], features: [], feats: [], spells: casterSpells,
    contentRefs: refs, classRolesAvailable: true, saveAction, selectedSpells,
    asiEvidence: { status: "complete", character_id: fixture.character.id, system_id: fixture.character.system_id,
      refs: refs as ContentRefWithContent[], grants: [] },
    schema: { ability_scores: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
      .map(slug => ({ slug, name: slug, abbr: slug.slice(0, 3) })),
      proficiency_levels: [], derived_stats: [], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] },
    castingSources: choices.classes!.map((cls, index) => ({ classSlug: cls.slug, classLevel: cls.level, kind: "class",
      parentPin: { contentId: refs[index].content_id, version: 2 }, active: true, config: { type: "full", ability: "charisma" },
      cantripsKnown: 1, spellsKnown: 2, prepared: false, preparationRule: "parent", spellList: { class: cls.slug, level: [0, 9] },
      directSlots: [2], maxLearnableLevel: 1 })),
  };
}
const casterPanel = (className: string) => within(screen.getByRole("form", { name: `${className} spell choices` }));
function pickWarlockSpell(index = 0) {
  fireEvent.change(casterPanel("Warlock").getByRole("combobox", { name: "Add warlock cantrips" }),
    { target: { value: `${casterSpells[index].id}:1` } });
}

describe("ClassStepClient confirmed native snapshots", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("adopts the other class's newer coherent refresh after acknowledging its own save, enabling both real panels", async () => {
    const save = vi.fn().mockResolvedValue({ choices: ownSavedChoices, scores: {}, action_revision: "43" });
    const { rerender } = render(<ClassStepClient {...casterClientProps("42", save)} />);
    expect(currentRail.mechanicsAvailable).toBe(true);
    pickWarlockSpell();
    fireEvent.click(casterPanel("Warlock").getByRole("button", { name: "Save spells" }));
    await casterPanel("Warlock").findByText("Spell choices saved.");
    expect(save).toHaveBeenCalledExactlyOnceWith("select_class_spells", { class_slug: "warlock",
      spells: [{ content_id: casterSpells[0].id, content_version: 1, prepared: false }] });
    expect(currentRail.localChoices).toEqual(ownSavedChoices);
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeDisabled();
    rerender(<ClassStepClient {...casterClientProps("44", save, laterSavedChoices, [casterPin(0, "warlock"), casterPin(1, "sorcerer")])} />);
    expect(currentRail.localChoices).toEqual(laterSavedChoices);
    expect(currentRail.mechanicsAvailable).toBe(true);
    for (const name of ["Warlock", "Sorcerer"]) {
      expect(casterPanel(name).getByRole("button", { name: "Save spells" })).toBeEnabled();
      expect(casterPanel(name).getByRole("combobox", { name: `${name} cantrips 1` })).toBeEnabled();
    }
    expect(casterPanel("Sorcerer").getByRole("combobox", { name: "Sorcerer cantrips 1" })).toHaveValue(`${casterSpells[1].id}:1`);
  });

  it("keeps acknowledged choices and revision through an older incoming refresh", async () => {
    const save = vi.fn().mockResolvedValue({ choices: ownSavedChoices, scores: {}, action_revision: "43" });
    const { rerender } = render(<ClassStepClient {...casterClientProps("42", save)} />);
    await act(async () => { await currentRail.onChoiceSelect("warlock-choice", ["own-pick"]); });
    rerender(<ClassStepClient {...casterClientProps("41", save)} />);
    expect(currentRail.localChoices).toEqual(ownSavedChoices);
    expect(currentRail.mechanicsAvailable).toBe(false);
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeDisabled();
    await act(async () => { currentRail.onAddClass({ ...fighter, slug: "cleric" }); });
    await act(async () => { currentPreview.onPick({ classSlug: "cleric", subclassSlug: null }); });
    expect(save).toHaveBeenLastCalledWith("add_class", expect.objectContaining({ expected_action_revision: "43" }));
  });

  it("does not roll a later refreshed snapshot back when an older spell receipt arrives late", async () => {
    const receipt = deferred<{ choices: CharacterChoices; scores: Record<string, number>; action_revision: string }>();
    const save = vi.fn().mockReturnValue(receipt.promise);
    const { rerender } = render(<ClassStepClient {...casterClientProps("42", save)} />);
    pickWarlockSpell();
    fireEvent.click(casterPanel("Warlock").getByRole("button", { name: "Save spells" }));
    rerender(<ClassStepClient {...casterClientProps("44", save, laterSavedChoices, [casterPin(0, "warlock"), casterPin(1, "sorcerer")])} />);
    expect(currentRail.localChoices).toEqual(laterSavedChoices);
    await act(async () => { receipt.resolve({ choices: ownSavedChoices, scores: {}, action_revision: "43" }); });
    await casterPanel("Warlock").findByText("Spell choices saved.");
    expect(currentRail.localChoices).toEqual(laterSavedChoices);
    expect(currentRail.mechanicsAvailable).toBe(true);
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeEnabled();
    expect(casterPanel("Sorcerer").getByRole("button", { name: "Save spells" })).toBeEnabled();
  });

  it("does not replace an active structural edit with incoming props and adopts the newer snapshot after it settles", async () => {
    const receipt = deferred<{ choices: CharacterChoices; scores: Record<string, number>; action_revision: string }>();
    const save = vi.fn().mockReturnValue(receipt.promise);
    const { rerender } = render(<ClassStepClient {...casterClientProps("42", save)} />);
    let pending: Promise<void> | void;
    await act(async () => { pending = currentRail.onLevelChange(0, 2); });
    expect(currentRail.selectedClasses[0].level).toBe(2);
    rerender(<ClassStepClient {...casterClientProps("44", save, laterSavedChoices)} />);
    expect(currentRail.selectedClasses[0].level).toBe(2);
    expect(currentRail.savePending).toBe(true);
    expect(casterPanel("Sorcerer").getByRole("button", { name: "Save spells" })).toBeDisabled();
    await act(async () => {
      receipt.resolve({ choices: { ...casterChoices, classes: casterChoices.classes!.map((cls, i) => i ? cls : { ...cls, level: 2 }) },
        scores: {}, action_revision: "43" });
      await pending;
    });
    expect(currentRail.localChoices).toEqual(laterSavedChoices);
    expect(currentRail.savePending).toBe(false);
    expect(currentRail.mechanicsAvailable).toBe(true);
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeEnabled();
  });

  it("retains a dirty child draft and offers enabled explicit resolution when newer saved selections conflict", () => {
    const save = vi.fn();
    const { rerender } = render(<ClassStepClient {...casterClientProps("42", save)} />);
    pickWarlockSpell();
    rerender(<ClassStepClient {...casterClientProps("44", save, laterSavedChoices, [casterPin(2, "warlock"), casterPin(1, "sorcerer")])} />);
    expect(currentRail.localChoices).toEqual(laterSavedChoices);
    expect(casterPanel("Warlock").getByRole("combobox", { name: "Warlock cantrips 1" })).toHaveValue(`${casterSpells[0].id}:1`);
    expect(casterPanel("Warlock").getByText(/Your draft is kept/)).toBeInTheDocument();
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeDisabled();
    expect(casterPanel("Warlock").getByRole("button", { name: "Use saved spells" })).toBeEnabled();
    expect(casterPanel("Sorcerer").getByRole("button", { name: "Save spells" })).toBeEnabled();
    fireEvent.click(casterPanel("Warlock").getByRole("button", { name: "Use saved spells" }));
    expect(casterPanel("Warlock").getByRole("combobox", { name: "Warlock cantrips 1" })).toHaveValue(`${casterSpells[2].id}:1`);
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeEnabled();
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps equal-revision prop disagreement blocked instead of choosing either document", () => {
    const save = vi.fn();
    const { rerender } = render(<ClassStepClient {...casterClientProps("44", save, laterSavedChoices)} />);
    rerender(<ClassStepClient {...casterClientProps("44", save, ownSavedChoices)} />);
    expect(currentRail.localChoices).toEqual(laterSavedChoices);
    expect(currentRail.mechanicsAvailable).toBe(false);
    expect(screen.getByText(/could not be matched to this account, character and revision/)).toBeInTheDocument();
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeDisabled();
  });

  it("blocks a contradictory equal-revision receipt without replacing the newer confirmed document", async () => {
    const receipt = deferred<{ choices: CharacterChoices; scores: Record<string, number>; action_revision: string }>();
    const save = vi.fn().mockReturnValue(receipt.promise);
    const { rerender } = render(<ClassStepClient {...casterClientProps("42", save)} />);
    pickWarlockSpell();
    fireEvent.click(casterPanel("Warlock").getByRole("button", { name: "Save spells" }));
    rerender(<ClassStepClient {...casterClientProps("44", save, laterSavedChoices)} />);
    await act(async () => { receipt.resolve({ choices: ownSavedChoices, scores: {}, action_revision: "44" }); });
    expect(currentRail.localChoices).toEqual(laterSavedChoices);
    expect(currentRail.mechanicsAvailable).toBe(false);
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeDisabled();
  });

  it.each(["account", "character"])("refuses to adopt a receipt or snapshot after the %s scope changes", async kind => {
    const receipt = deferred<{ choices: CharacterChoices; scores: Record<string, number>; action_revision: string }>();
    const save = vi.fn().mockReturnValue(receipt.promise);
    const { rerender } = render(<ClassStepClient {...casterClientProps("42", save)} />);
    pickWarlockSpell();
    fireEvent.click(casterPanel("Warlock").getByRole("button", { name: "Save spells" }));
    const other = casterClientProps("44", save, laterSavedChoices);
    if (kind === "account") other.accountId = "50000000-0000-4000-8000-000000000002";
    else { other.characterId = "50000000-0000-4000-8000-000000000003"; other.character.id = other.characterId; }
    rerender(<ClassStepClient {...other} />);
    await act(async () => { receipt.resolve({ choices: ownSavedChoices, scores: {}, action_revision: "43" }); });
    expect(currentRail.localChoices).toEqual(casterChoices);
    expect(currentRail.mechanicsAvailable).toBe(false);
    expect(casterPanel("Warlock").getByRole("combobox", { name: "Warlock cantrips 1" })).toHaveValue(`${casterSpells[0].id}:1`);
    expect(casterPanel("Warlock").getByRole("button", { name: "Save spells" })).toBeDisabled();
    expect(casterPanel("Warlock").getByText(/These spell choices could not be confirmed/)).toBeInTheDocument();
  });

  it("orders native bigint revisions above Number's exact integer range", async () => {
    const save = vi.fn().mockResolvedValue({ choices: ownSavedChoices, scores: {}, action_revision: "9007199254740993" });
    const { rerender } = render(<ClassStepClient {...casterClientProps("9007199254740992", save)} />);
    await act(async () => { await currentRail.onChoiceSelect("warlock-choice", ["own-pick"]); });
    rerender(<ClassStepClient {...casterClientProps("9007199254740994", save, laterSavedChoices)} />);
    expect(currentRail.localChoices).toEqual(laterSavedChoices);
    expect(currentRail.mechanicsAvailable).toBe(true);
  });
});

describe("ClassStepClient feat regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("passes the exact saved ancestry bonus and complete evidence to the class sidebar", () => {
    const f = ancestryHpFixture(), definition = { ...f.classRef.content_definitions, name: "Barbarian", effects: [] };
    const schema = { ability_scores: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
      .map(slug => ({ slug, name: slug, abbr: slug.slice(0, 3) })),
      proficiency_levels: [], derived_stats: [], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
    render(<ClassStepClient characterId={f.character.id} character={{ ...f.character, name: "Hill control", state: {} }}
      classes={[definition]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={f.refs as ComponentProps<typeof ClassStepClient>["contentRefs"]}
      schema={schema} classRolesAvailable saveAction={vi.fn()} asiEvidence={{ status: "complete", character_id: f.character.id,
        system_id: f.character.system_id, refs: f.refs as ContentRefWithContent[], grants: [] }} />);
    expect(currentStatPreview.classContext?.ancestryHitPoints).toEqual({ status: "available", bonus: 3 });
    expect(currentStatPreview.classContext?.originalOccurrenceId).toBe(f.character.choices.classes![0].occurrence_id);
  });
  it("passes saved equipment effects and derived state to the actual sidebar instead of stale parent equipment fields", () => {
    const equipmentPreview = { effects: [{ type: "mechanical" as const, stat: "armor_class", op: "formula" as const,
      expr: "11 + mod(dexterity)", tag: "ac_formula" }], state: { equipped_armor: "light", shield_equipped: true } };
    renderClient({ classes: [{ slug: "fighter", level: 4 }] }, undefined, { equipmentPreview, schema: {
      ability_scores: [], proficiency_levels: [], derived_stats: [], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
    } });
    expect(currentStatPreview.state).toEqual(equipmentPreview.state);
    expect(currentStatPreview.effects).toEqual(equipmentPreview.effects);
  });

  it("adds a native class with the displayed revision and never uses legacy writes or native removal", async () => {
    const choices = { classes: [{ slug: "fighter", level: 4, occurrence_id: "fighter-occurrence" }] };
    const added = { classes: [...choices.classes, { slug: "cleric", level: 1, occurrence_id: "cleric-occurrence" }] };
    const save = vi.fn().mockResolvedValue({ choices: added, scores: {}, action_revision: "9" });
    renderClient(choices, save, { classRolesAvailable: true, action_revision: "8" });
    expect(currentRail.classChangesAvailable).toBe(true);
    expect(currentRail.classRemovalAvailable).toBe(false);
    const cleric = { ...fighter, id: "10000000-0000-4000-8000-000000000005", slug: "cleric", name: "Cleric" };
    await act(async () => { currentRail.onAddClass(cleric); });
    expect(currentPreview.acquisitionOnly).toBe(true);
    await act(async () => { currentPreview.onPick({ classSlug: "cleric", subclassSlug: "life" }); });
    expect(save).toHaveBeenCalledExactlyOnceWith("add_class", { class_id: cleric.id, class_version: 1, expected_action_revision: "8" });
    expect(currentRail.localChoices).toEqual(added);
    await act(async () => { await currentRail.onRemoveClass(0); });
    expect(mocks.updateCharacter).not.toHaveBeenCalled();
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
  });

  it("keeps the saved build after a refused native Add without a legacy fallback", async () => {
    const choices = { classes: [{ slug: "fighter", level: 4, occurrence_id: "fighter-occurrence" }] };
    const save = vi.fn().mockRejectedValue(Error("refused"));
    renderClient(choices, save, { classRolesAvailable: true, action_revision: "8" });
    await act(async () => { currentRail.onAddClass({ ...fighter, slug: "cleric" }); });
    await act(async () => { currentPreview.onPick({ classSlug: "cleric", subclassSlug: null }); });
    expect(currentRail.localChoices).toEqual(choices);
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("could not be confirmed");
  });

  it("keeps the starting class fixed and waits for confirmed secondary removal before adopting the pruned build", async () => {
    const classes = [{ slug: "fighter", level: 4, occurrence_id: "30000000-0000-4000-8000-000000000001" },
      { slug: "cleric", level: 2, occurrence_id: "30000000-0000-4000-8000-000000000002" }];
    const choices = { classes, race: "half-elf", hp_rolls: { "fighter-2": { method: "average" as const, value: 6 } } };
    const retained = { ...choices, classes: [classes[0]] };
    const pending = deferred<{ choices: CharacterChoices; scores: Record<string, number>; action_revision: string }>();
    const save = vi.fn().mockReturnValue(pending.promise);
    renderClient(choices, save, { classRolesAvailable: true, action_revision: "8", contentRefs: nativeClassRefs(classes) });
    expect(currentRail.classRemovalAvailable).toBe(true);
    expect(currentRail.originalOccurrenceId).toBe(classes[0].occurrence_id);
    await act(async () => { await currentRail.onRemoveClass(0); });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Your starting class is fixed");
    let removal: Promise<void> | void = undefined;
    await act(async () => { removal = currentRail.onRemoveClass(1); });
    expect(save).toHaveBeenCalledExactlyOnceWith("remove_class", { occurrence_id: classes[1].occurrence_id, expected_action_revision: "8" });
    expect(currentRail.localChoices).toEqual(choices);
    await act(async () => { pending.resolve({ choices: retained, scores: {}, action_revision: "9" }); await removal; });
    expect(currentRail.localChoices).toEqual(retained);
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.updateCharacter).not.toHaveBeenCalled();
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
  });

  it("retains the saved classes after a refused removal without falling back to legacy writes", async () => {
    const classes = [{ slug: "fighter", level: 4, occurrence_id: "30000000-0000-4000-8000-000000000001" },
      { slug: "cleric", level: 2, occurrence_id: "30000000-0000-4000-8000-000000000002" }];
    const choices = { classes };
    const save = vi.fn().mockRejectedValue(Error("stale"));
    renderClient(choices, save, { classRolesAvailable: true, action_revision: "8", contentRefs: nativeClassRefs(classes) });
    await act(async () => { await currentRail.onRemoveClass(1); });
    expect(currentRail.localChoices).toEqual(choices);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(mocks.updateCharacter).not.toHaveBeenCalled();
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
  });

  it("re-adds through the accepted removal revision and adopts the new server occurrence", async () => {
    const classes = [{ slug: "fighter", level: 4, occurrence_id: "30000000-0000-4000-8000-000000000001" },
      { slug: "cleric", level: 2, occurrence_id: "30000000-0000-4000-8000-000000000002" }];
    const retained = { classes: [classes[0]] };
    const readded = { classes: [classes[0], { ...classes[1], level: 1, occurrence_id: "30000000-0000-4000-8000-000000000003" }] };
    const save = vi.fn().mockResolvedValueOnce({ choices: retained, scores: {}, action_revision: "9" })
      .mockResolvedValueOnce({ choices: readded, scores: {}, action_revision: "10" });
    renderClient({ classes }, save, { classRolesAvailable: true, action_revision: "8", contentRefs: nativeClassRefs(classes) });
    await act(async () => { await currentRail.onRemoveClass(1); });
    const cleric = { ...fighter, id: "10000000-0000-4000-8000-000000000005", slug: "cleric", name: "Cleric" };
    await act(async () => { currentRail.onAddClass(cleric); });
    await act(async () => { currentPreview.onPick({ classSlug: "cleric", subclassSlug: null }); });
    expect(save).toHaveBeenLastCalledWith("add_class", { class_id: cleric.id, class_version: 1, expected_action_revision: "9" });
    expect(currentRail.localChoices).toEqual(readded);
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
  });

  it("explains preserved legacy Fiend content without changing its pin or choices", () => {
    const choices = { classes: [{ slug: "warlock", level: 1, subclass: "fiend", occurrence_id: "30000000-0000-4000-8000-000000000001" }] };
    const fiendRef = { id: "fiend-ref", content_id: "fiend", content_version: 1, context: {}, choice_source: null,
      content_definitions: { ...fighter, id: "fiend", slug: "fiend", name: "Fiend", content_type: "subclass",
        data: { parent_class: "warlock", spellcastingExtra: [{ level: 1, spells: ["burning-hands"] }] } } };
    const save = vi.fn();
    renderClient(choices, save, { action_revision: "8", contentRefs: [fiendRef] });
    expect(screen.getByText("Your saved Fiend content uses an earlier spell-list version. Your choices are preserved. Correct expanded spell choices require a reviewed content-version update.")).toBeInTheDocument();
    expect(currentRail.localChoices).toEqual(choices);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps Add unavailable without native role proof instead of inferring the original array entry", async () => {
    const save = vi.fn();
    renderClient({ classes: [{ slug: "fighter", level: 4, occurrence_id: "fighter-occurrence" }] }, save, { action_revision: "8" });
    expect(currentRail.classChangesAvailable).toBe(false);
    await act(async () => { currentRail.onAddClass({ ...fighter, slug: "cleric" }); });
    await act(async () => { currentPreview.onPick({ classSlug: "cleric", subclassSlug: null }); });
    expect(save).not.toHaveBeenCalled();
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
  });

  it("uses the last accepted revision after another native save without fetching a newer revision for stale intent", async () => {
    const choices = { classes: [{ slug: "fighter", level: 4, occurrence_id: "fighter-occurrence" }] };
    const save = vi.fn().mockResolvedValueOnce({ choices, scores: {}, action_revision: "9" })
      .mockResolvedValueOnce({ choices, scores: {}, action_revision: "10" });
    renderClient(choices, save, { classRolesAvailable: true, action_revision: "8" });
    await act(async () => { await currentRail.onChoiceSelect("fighter-skills", ["skill-athletics"]); });
    await act(async () => { currentRail.onAddClass({ ...fighter, slug: "cleric" }); });
    await act(async () => { currentPreview.onPick({ classSlug: "cleric", subclassSlug: null }); });
    expect(save).toHaveBeenLastCalledWith("add_class", { class_id: fighter.id, class_version: 1, expected_action_revision: "9" });
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
  });

  it("uses the accepted domain saver for class choices and style pins without a legacy write", async () => {
    const choices = { classes: [{ slug: "fighter", level: 1, occurrence_id: "native-occurrence" }] };
    const saved = { ...choices, race: "half-elf", resolved_choices: { skills: ["skill-athletics"] } };
    const save = vi.fn().mockResolvedValueOnce({ choices: saved, scores: {}, action_revision: "9" })
      .mockResolvedValueOnce({ choices: saved, scores: {}, action_revision: "10" });
    renderClient(choices, save);
    await act(async () => { await currentRail.onChoiceSelect("skills", ["skill-athletics"]); });
    expect(save).toHaveBeenLastCalledWith("class_choice", { choice_id: "skills", selections: ["skill-athletics"] });
    expect(currentRail.localChoices).toEqual(saved);
    await act(async () => { await currentRail.onFightingStyleSelect("fighter-fighting-style", "fighter", "fighter-defense"); });
    expect(save).toHaveBeenLastCalledWith("fighting_style", { feature_slug: "fighter-fighting-style", style_slug: "fighter-defense" });
    expect(mocks.updateCharacter).not.toHaveBeenCalled();
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
  });

  it("sends Favored Enemy through the finite native saver and preserves choices when refused", async () => {
    const choices = { classes: [{ slug: "ranger", level: 1, occurrence_id: "native-occurrence" }] };
    const value = { selection: { mode: "humanoids" as const, races: ["elf", "goblin"] }, language: "goblin" };
    const saved = { ...choices, favored_enemies: { "favored-enemy": value } };
    const save = vi.fn().mockResolvedValueOnce({ choices: saved, scores: {}, action_revision: "9" })
      .mockRejectedValueOnce(Error("refused"));
    renderClient(choices, save);
    await act(async () => { await currentRail.onFavoredEnemySelect?.("favored-enemy", value); });
    expect(save).toHaveBeenCalledWith("favored_enemy", { feature_slug: "favored-enemy", ...value });
    expect(currentRail.localChoices).toEqual(saved);
    await act(async () => { await expect(currentRail.onFavoredEnemySelect?.("favored-enemy", { selection: { mode: "type", enemy_type: "undead" }, language: null })).rejects.toThrow(); });
    expect(currentRail.localChoices).toEqual(saved);
    expect(mocks.updateCharacter).not.toHaveBeenCalled();
    expect(mocks.updateCharacterAndReturn).not.toHaveBeenCalled();
  });

  it("never falls back to a whole choices write after a refused native class choice", async () => {
    const choices = { classes: [{ slug: "fighter", level: 1 }] };
    renderClient(choices, vi.fn().mockRejectedValue(Error("refused")));
    await act(async () => { await currentRail.onChoiceSelect("skills", ["skill-athletics"]); });
    expect(currentRail.localChoices).toEqual(choices);
    expect(mocks.updateCharacter).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("could not be confirmed");
  });

  it("uses canonical level-down choices so leveling back up cannot resurrect a pruned ASI feat", async () => {
    const initialChoices: CharacterChoices = {
      classes: [{ slug: "fighter", level: 4 }],
      asi_choices: {
        "fighter-asi-4": {
          mode: "feat",
          featId: emberSentinel.id,
          featVersion: emberSentinel.version,
          featName: emberSentinel.name,
        },
      },
    };
    const canonicalLevelThree: CharacterChoices = {
      classes: [{ slug: "fighter", level: 3 }],
    };
    const canonicalLevelFour: CharacterChoices = {
      classes: [{ slug: "fighter", level: 4 }],
    };
    mocks.updateCharacterAndReturn
      .mockResolvedValueOnce({ choices: canonicalLevelThree, level: 3 })
      .mockResolvedValueOnce({ choices: canonicalLevelFour, level: 4 });

    renderClient(initialChoices);
    expect(screen.getByLabelText("selected ASI feat")).toHaveTextContent("Ember Sentinel");

    fireEvent.click(screen.getByRole("button", { name: "Level down" }));
    await waitFor(() => {
      expect(screen.getByLabelText("class level")).toHaveTextContent("3");
      expect(screen.getByLabelText("selected ASI feat")).toHaveTextContent("none");
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Level up" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Level up" }));
    await waitFor(() => expect(mocks.updateCharacterAndReturn).toHaveBeenCalledTimes(2));

    expect(mocks.updateCharacterAndReturn.mock.calls[1]).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      {
        choices: canonicalLevelFour,
        level: 4,
      },
    ]);
    expect(screen.getByLabelText("selected ASI feat")).toHaveTextContent("none");
  });

  it("keeps the feat name for optimistic display but sends only its id and version", async () => {
    const mutation = deferred<{
      status: "success";
      choices: CharacterChoices;
    }>();
    mocks.setCharacterAsiChoiceAction.mockReturnValueOnce(mutation.promise);

    renderClient({ classes: [{ slug: "fighter", level: 4 }] });
    fireEvent.click(screen.getByRole("button", { name: "Choose Ember Sentinel" }));

    await waitFor(() => {
      expect(screen.getByLabelText("selected ASI feat")).toHaveTextContent("Ember Sentinel");
    });
    expect(mocks.setCharacterAsiChoiceAction).toHaveBeenCalledWith({
      characterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      featureSlug: "fighter-asi-4",
      choice: {
        mode: "feat",
        featId: emberSentinel.id,
        featVersion: emberSentinel.version,
      },
    });
    expect(mocks.setCharacterAsiChoiceAction.mock.calls[0][0].choice).not.toHaveProperty("featName");

    mutation.resolve({
      status: "success",
      choices: {
        classes: [{ slug: "fighter", level: 4 }],
        asi_choices: {
          "fighter-asi-4": {
            mode: "feat",
            featId: emberSentinel.id,
            featVersion: emberSentinel.version,
            featName: emberSentinel.name,
          },
        },
      },
    });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });
  it("blocks competing class and ASI writes while a canonical level save is pending", async () => {
    const mutation = deferred<{ choices: CharacterChoices; level: number }>();
    mocks.updateCharacterAndReturn.mockReturnValueOnce(mutation.promise);
    renderClient({ classes: [{ slug: "fighter", level: 4 }] });
    fireEvent.click(screen.getByRole("button", { name: "Level down" }));
    expect(screen.getByRole("button", { name: "Choose Ember Sentinel" })).toBeDisabled();
    // Portal callbacks are outside the fieldset: the handler gate also protects them.
    await act(async () => {
      await expect(currentRail.onAsiSelect("fighter-asi-4", { mode: "asi", allocations: [{ ability: "strength", amount: 2 }] })).rejects.toThrow(/saving/i);
    });
    expect(mocks.setCharacterAsiChoiceAction).not.toHaveBeenCalled();
    expect(mocks.updateCharacterAndReturn).toHaveBeenCalledOnce();
    await act(async () => mutation.resolve({ choices: { classes: [{ slug: "fighter", level: 3 }] }, level: 3 }));
    expect(screen.getByRole("button", { name: "Level up" })).toBeEnabled();
    expect(screen.getByLabelText("class level")).toHaveTextContent("3");
  });

});
