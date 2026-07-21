import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassStepRail } from "@/components/builder/class-step-rail";
import type { ContentEntry } from "@/components/builder/content-browser";
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

vi.mock("@/components/builder/class-preview-modal", () => ({
  ClassPreviewModal: () => null,
}));

vi.mock("@/components/builder/stat-preview", () => ({
  StatPreview: () => null,
}));

type RailProps = ComponentProps<typeof ClassStepRail>;

vi.mock("@/components/builder/class-step-rail", () => ({
  ClassStepRail: (props: RailProps) => {
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

function renderClient(choices: CharacterChoices) {
  return render(
    <ClassStepClient
      characterId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      character={{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Tamsin",
        level: 4,
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
});
