import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassStepRail } from "@/components/builder/class-step-rail";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { ClassPreviewModalProps } from "@/components/builder/class-preview-modal";
import type { CharacterChoices, UsableFeatOption } from "@/lib/types/character";

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

vi.mock("@/components/builder/stat-preview", () => ({
  StatPreview: () => null,
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
    contentRefs?: ComponentProps<typeof ClassStepClient>["contentRefs"] }) {
  return render(
    <ClassStepClient
      saveAction={saveAction}
      classRolesAvailable={native?.classRolesAvailable}
      characterId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      character={{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Tamsin",
        level: 4,
        action_revision: native?.action_revision,
        base_stats: {},
        choices,
      }}
      classes={[fighter]}
      subclasses={[]}
      features={[]}
      feats={[emberSentinel]}
      spells={[]}
      contentRefs={native?.contentRefs ?? []}
      schema={undefined}
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

describe("ClassStepClient feat regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const save = vi.fn().mockResolvedValue({ choices: saved, scores: {} });
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
