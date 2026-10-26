import { Activity } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices } from "@/lib/types/character";
import type { SaveBuilderStep } from "@/lib/builder/builder-step-command";

const navigation = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/lib/supabase/character-client", () => ({
  updateCharacter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/background-selection-client", () => ({
  setCharacterBackground: vi.fn(),
}));

vi.mock("@/components/builder/content-browser", () => ({
  ContentBrowser: ({ entries, onSelect }: {
    entries: ContentEntry[];
    onSelect: (entry: ContentEntry) => void;
  }) => (
    <button type="button" onClick={() => onSelect(entries[0])}>
      Choose first background
    </button>
  ),
}));

vi.mock("@/components/builder/content-preview", () => ({
  ContentPreview: ({ content, onConfirm }: {
    content: ContentEntry | null;
    onConfirm: (entry: ContentEntry) => void;
  }) => content ? (
    <button type="button" onClick={() => onConfirm(content)}>
      Confirm background preview
    </button>
  ) : null,
}));

vi.mock("@/components/builder/choice-selector", () => ({
  ChoiceSelector: () => null,
}));

vi.mock("@/components/builder/stat-preview", () => ({
  StatPreview: () => null,
}));

import { BackgroundStepClient } from "@/app/(app)/characters/[id]/builder/background/background-step-client";
import { updateCharacter } from "@/lib/supabase/character-client";
import { setCharacterBackground } from "@/lib/supabase/background-selection-client";

const setBackgroundMock = vi.mocked(setCharacterBackground);

const currentBackground = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Mutable Courier",
  slug: "lantern-courier",
  content_type: "background",
  data: {
    feature: { name: "Changed Roads", description: "The mutable description." },
    personality_traits: ["A new trait."],
    ideals: [],
    bonds: [],
    flaws: [],
  },
  effects: [],
  version: 2,
  source: "homebrew",
};

const pinnedRef = {
  id: "33333333-3333-4333-8333-333333333333",
  content_id: currentBackground.id,
  context: { source: "background" },
  choice_source: "choice:background",
  content_definitions: {
    ...currentBackground,
    name: "Pinned Courier",
    data: {
      ...currentBackground.data,
      feature: { name: "Known Roads", description: "The exact v1 description." },
      personality_traits: ["I always carry a spare light."],
    },
    version: 1,
  },
};

function renderStep({
  choices = { background: "lantern-courier" },
  contentRefs = [pinnedRef],
  saveAction,
}: {
  choices?: CharacterChoices;
  contentRefs?: React.ComponentProps<typeof BackgroundStepClient>["contentRefs"];
  saveAction?: SaveBuilderStep;
} = {}) {
  return render(
    <BackgroundStepClient
      characterId="22222222-2222-4222-8222-222222222222"
      character={{
        id: "22222222-2222-4222-8222-222222222222",
        level: 1,
        base_stats: {},
        choices,
      }}
      backgrounds={[currentBackground]}
      contentRefs={contentRefs}
      schema={undefined}
      saveAction={saveAction}
    />,
  );
}

describe("BackgroundStepClient", () => {
  it.each([["one", "one"], ["one", "two", "three"]])("shows and explicitly clears invalid saved narrative picks: %j", async (...values) => {
    const choices: CharacterChoices = { background: "lantern-courier", personality_traits: values };
    const pin = { ...pinnedRef, content_definitions: { ...pinnedRef.content_definitions,
      data: { ...pinnedRef.content_definitions.data, personality_traits: ["one", "two", "three"] } } };
    renderStep({ choices, contentRefs: [pin] });
    expect(screen.getByText(`Saved notes: ${values.join("; ")}`)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Personality Traits 1" })).toBeDisabled();
    expect(updateCharacter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear personality traits" }));
    await waitFor(() => expect(updateCharacter).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222",
      { choices: { background: "lantern-courier", personality_traits: [] } }));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateCharacter).mockResolvedValue(undefined);
    setBackgroundMock.mockResolvedValue({
      savedChoices: { background: "lantern-courier" },
      selectedContentId: currentBackground.id,
      selectedContentVersion: 2,
    });
  });

  it("uses the injected atomic selection with an exact tuple and canonical returned choices", async () => {
    const saveAction = vi.fn<SaveBuilderStep>().mockResolvedValue({ scores: {}, action_revision: "2", choices: {
      background: "lantern-courier", ideals: ["A note retained by the server"],
    } });
    renderStep({ choices: {}, contentRefs: [], saveAction });
    fireEvent.click(screen.getByRole("button", { name: "Choose first background" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm background preview" }));
    await waitFor(() => expect(saveAction).toHaveBeenCalledExactlyOnceWith("select_background", {
      content_id: currentBackground.id, content_version: currentBackground.version,
    }));
    expect(await screen.findByText("Mutable Courier")).toBeVisible();
    expect(screen.getByPlaceholderText("Enter custom ideals")).toHaveValue("A note retained by the server");
    expect(setBackgroundMock).not.toHaveBeenCalled(); expect(updateCharacter).not.toHaveBeenCalled();
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("does not fall back to the old background RPC when an injected atomic save refuses", async () => {
    const saveAction = vi.fn<SaveBuilderStep>().mockRejectedValue(Error("unavailable"));
    renderStep({ saveAction });
    fireEvent.click(screen.getByRole("button", { name: "Change Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose first background" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm background preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be selected");
    expect(setBackgroundMock).not.toHaveBeenCalled(); expect(updateCharacter).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("sends only the narrative domain patch and uses canonical choices without a direct parent write", async () => {
    const saveAction = vi.fn<SaveBuilderStep>().mockResolvedValue({ scores: {}, action_revision: "2", choices: {
      background: "lantern-courier", ideals: ["A server-normalized note"],
    } });
    renderStep({ saveAction });
    const input = screen.getByPlaceholderText("Enter custom ideals");
    fireEvent.change(input, { target: { value: "Keep promises" } }); fireEvent.blur(input);
    await waitFor(() => expect(saveAction).toHaveBeenCalledExactlyOnceWith("background_narrative", { key: "ideals", values: ["Keep promises"] }));
    await waitFor(() => expect(input).toHaveValue("A server-normalized note"));
    expect(updateCharacter).not.toHaveBeenCalled(); expect(setBackgroundMock).not.toHaveBeenCalled();
  });

  it("ignores a different saved background before the matching pin", () => {
    const unrelated = { ...pinnedRef, id: "other-pin", content_id: "other-background", content_definitions: { ...pinnedRef.content_definitions, id: "other-background", slug: "other-background", name: "Wrong Background" } };
    renderStep({ contentRefs: [unrelated, pinnedRef] });
    expect(screen.getByText("Pinned Courier")).toBeVisible();
    expect(screen.queryByText("Wrong Background")).not.toBeInTheDocument();
  });

  it("does not show another background's data when the selected pin is missing", () => {
    renderStep({ choices: { background: "missing-background" } });
    expect(screen.queryByText("Pinned Courier")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("no matching saved snapshot");
  });

  it("blocks editing when matching background snapshots conflict", () => {
    renderStep({ contentRefs: [pinnedRef, { ...pinnedRef, id: "duplicate-pin", content_definitions: { ...pinnedRef.content_definitions, version: 2, name: "Other Courier" } }] });
    expect(screen.getByRole("alert")).toHaveTextContent("Multiple saved snapshots");
    expect(screen.queryByText("Pinned Courier")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose first background" })).toBeDisabled();
    expect(setBackgroundMock).not.toHaveBeenCalled();
  });

  it("keeps custom text editable until blur and retains a failed draft for explicit retry", async () => {
    let rejectSave!: (error: Error) => void;
    vi.mocked(updateCharacter).mockReturnValueOnce(new Promise<void>((_, reject) => { rejectSave = reject; }));
    renderStep();
    const input = screen.getByPlaceholderText("Enter custom ideals");
    fireEvent.change(input, { target: { value: "Keep promises" } });
    expect(input).toBeEnabled();
    expect(vi.mocked(updateCharacter)).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    await act(async () => rejectSave(new Error("offline")));
    expect(input).toHaveValue("Keep promises");
    expect(input).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("could not be confirmed");
    fireEvent.focus(input); fireEvent.blur(input);
    await waitFor(() => expect(vi.mocked(updateCharacter)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updateCharacter).mock.calls[1][1]).toEqual({ choices: { background: "lantern-courier", ideals: ["Keep promises"] } });
    await waitFor(() => expect(screen.queryByText(/unsaved notes/i)).not.toBeInTheDocument());
  });

  it("keeps a failed custom note accessible when replacement is requested, then permits replacement after retry", async () => {
    vi.mocked(updateCharacter).mockRejectedValueOnce(new Error("private note detail"));
    renderStep();
    const input=screen.getByRole("textbox",{name:"Ideals"});
    fireEvent.change(input,{target:{value:"Protect my village"}});
    fireEvent.blur(input);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button",{name:"Change Background"}));
    expect(screen.getByRole("alert")).toHaveTextContent("Save your unconfirmed notes");
    expect(screen.getByRole("textbox",{name:"Ideals"})).toHaveValue("Protect my village");
    expect(screen.queryByRole("button",{name:"Choose first background"})).not.toBeInTheDocument();
    expect(setBackgroundMock).not.toHaveBeenCalled();
    fireEvent.focus(input);fireEvent.blur(input);
    await waitFor(()=>expect(screen.queryByText(/unsaved notes/i)).not.toBeInTheDocument());
    expect(vi.mocked(updateCharacter).mock.calls[1][1].choices?.ideals).toEqual(["Protect my village"]);
    fireEvent.click(screen.getByRole("button",{name:"Change Background"}));
    fireEvent.click(screen.getByRole("button",{name:"Choose first background"}));
    fireEvent.click(screen.getByRole("button",{name:"Confirm background preview"}));
    await waitFor(()=>expect(setBackgroundMock).toHaveBeenCalledOnce());
  });

  it("reconciles a background note saved while Activity is hidden", async () => {
    let resolveSave!: () => void;
    vi.mocked(updateCharacter).mockReturnValueOnce(new Promise<void>(resolve => { resolveSave = resolve; }));
    const view = (mode: "visible" | "hidden") => <Activity mode={mode}><BackgroundStepClient characterId="char-1" character={{ id: "char-1", level: 1, base_stats: {}, choices: { background: "lantern-courier" } }} backgrounds={[currentBackground]} contentRefs={[pinnedRef]} schema={undefined} /></Activity>;
    const rendered = render(view("visible"));
    fireEvent.change(screen.getByLabelText("Ideals"), { target: { value: "Keep promises" } });
    fireEvent.blur(screen.getByLabelText("Ideals"));
    rendered.rerender(view("hidden"));
    await act(async () => resolveSave());
    rendered.rerender(view("visible"));
    expect(screen.getByLabelText("Ideals")).toHaveValue("Keep promises");
    expect(screen.getByRole("button", { name: "Change Background" })).toBeEnabled();
    expect(screen.queryByText(/unsaved notes/i)).not.toBeInTheDocument();
    expect(vi.mocked(updateCharacter)).toHaveBeenCalledOnce();
  });

  it("renders the exact pinned snapshot instead of the mutable catalog row", () => {
    renderStep();

    expect(screen.getByText("Pinned Courier")).toBeVisible();
    expect(screen.getByText("Known Roads")).toBeVisible();
    expect(screen.getByText("The exact v1 description.")).toBeVisible();
    expect(screen.getByText("v1")).toBeVisible();
    expect(screen.queryByText("Mutable Courier")).not.toBeInTheDocument();
    expect(screen.queryByText("The mutable description.")).not.toBeInTheDocument();
  });

  it("selects one exact version through the atomic RPC", async () => {
    renderStep({ choices: {}, contentRefs: [] });

    fireEvent.click(screen.getByRole("button", { name: "Choose first background" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm background preview" }));

    await waitFor(() => expect(setBackgroundMock).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      currentBackground.id,
      2,
    ));
    expect(await screen.findByText("Mutable Courier")).toBeVisible();
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("keeps the current background until a replacement is confirmed", async () => {
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Change Background" }));

    expect(setBackgroundMock).not.toHaveBeenCalled();
    expect(screen.getByText(/stays saved until you confirm a replacement/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep Current Background" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Choose first background" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm background preview" }));

    await waitFor(() => expect(setBackgroundMock).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      currentBackground.id,
      2,
    ));
    expect(await screen.findByText("Mutable Courier")).toBeVisible();
  });

  it("cancels replacement browsing without writing or losing the current background", () => {
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Change Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep Current Background" }));

    expect(setBackgroundMock).not.toHaveBeenCalled();
    expect(screen.getByText("Pinned Courier")).toBeVisible();
  });

  it("locks background interactions while the atomic replacement is saving", async () => {
    let finishSave!: (
      value: Awaited<ReturnType<typeof setCharacterBackground>>,
    ) => void;
    setBackgroundMock.mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Change Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose first background" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm background preview" }));

    expect(await screen.findByText("Saving background.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose first background" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep Current Background" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next: Equipment" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Choose first background" }));
    expect(setBackgroundMock).toHaveBeenCalledTimes(1);

    finishSave({
      savedChoices: { background: "lantern-courier" },
      selectedContentId: currentBackground.id,
      selectedContentVersion: 2,
    });

    expect(await screen.findByText("Mutable Courier")).toBeVisible();
  });

  it("restores the pinned selection and explains an atomic failure", async () => {
    setBackgroundMock.mockRejectedValue(new Error("denied"));
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Change Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose first background" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm background preview" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be selected/i);
    expect(screen.getByText(/current background: pinned courier/i)).toBeVisible();
  });

  it("explains why a confirmed equipment selection prevents a background change", async () => {
    setBackgroundMock.mockRejectedValue(
      new Error(
        "Background changes are unavailable after starting equipment is confirmed",
      ),
    );
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Change Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose first background" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm background preview" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /starting equipment is already confirmed/i,
    );
    expect(screen.getByText(/current background: pinned courier/i)).toBeVisible();
  });
});
