import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices } from "@/lib/types/character";

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
}: {
  choices?: CharacterChoices;
  contentRefs?: React.ComponentProps<typeof BackgroundStepClient>["contentRefs"];
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
    />,
  );
}

describe("BackgroundStepClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBackgroundMock.mockResolvedValue({
      savedChoices: { background: "lantern-courier" },
      selectedContentId: currentBackground.id,
      selectedContentVersion: 2,
    });
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
