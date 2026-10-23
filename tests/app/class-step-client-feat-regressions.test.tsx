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
  native?: { classRolesAvailable?: boolean; action_revision?: string }) {
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
      contentRefs={[]}
      schema={undefined}
    />,
  );
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
