import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaceStepClient } from "@/app/(app)/characters/[id]/builder/race/race-step-client";
import { ClassStepClient } from "@/app/(app)/characters/[id]/builder/class/class-step-client";
import { BackgroundStepClient } from "@/app/(app)/characters/[id]/builder/background/background-step-client";
import type { ContentEntry } from "@/components/builder/content-browser";

const mocks = vi.hoisted(() => ({ update: vi.fn(), canonical: vi.fn(), insert: vi.fn(), remove: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/lib/supabase/character-client", () => ({ updateCharacter: mocks.update, updateCharacterAndReturn: mocks.canonical }));
vi.mock("@/lib/supabase/content-refs-client", () => ({ insertContentRef: mocks.insert, removeContentRefById: mocks.remove }));
vi.mock("@/lib/supabase/background-selection-client", () => ({ setCharacterBackground: vi.fn() }));
vi.mock("@/app/(app)/characters/[id]/builder/class/actions", () => ({ searchUsableFeatsAction: vi.fn(), setCharacterAsiChoiceAction: vi.fn() }));
vi.mock("@/components/builder/stat-preview", () => ({ StatPreview: () => null }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const human: ContentEntry = { id: "human", name: "Human", slug: "human", content_type: "race", data: {}, effects: [], version: 1, source: "srd" };
const elf: ContentEntry = { ...human, id: "elf", name: "Elf", slug: "elf" };
const woodElf: ContentEntry = { ...human, id: "wood-elf", name: "Wood Elf", slug: "wood-elf", content_type: "subrace", data: { parent_race: "elf" } };
const character = { id: "char-1", name: "Fresh hero", level: 1, base_stats: {}, choices: {} };
function race(choices = {}) { return render(<RaceStepClient characterId="char-1" character={{ ...character, choices }} races={[human, elf]} subraces={[woodElf]} traits={[]} contentRefs={[]} schema={undefined} />); }

describe("builder choice error recovery with real selection controls", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.update.mockResolvedValue(undefined); mocks.insert.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it("reports a failed race write without exposing server details", async () => {
    mocks.update.mockRejectedValueOnce(new Error("private database detail")); race();
    fireEvent.click(screen.getByRole("button", { name: "Preview Human" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Race" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reload the character");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private database detail");
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Preview Human" })).toBeEnabled();
  });

  it("warns about a partially saved race instead of implying a rollback", async () => {
    mocks.insert.mockRejectedValueOnce(new Error("ref failed")); race();
    fireEvent.click(screen.getByRole("button", { name: "Preview Human" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Race" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Some changes may have saved");
    expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("locks competing race actions and navigation while selecting a subrace", async () => {
    let resolve!: () => void; mocks.update.mockReturnValueOnce(new Promise<void>((done) => { resolve = done; }));
    race({ race: "elf" });
    fireEvent.click(screen.getByRole("button", { name: "Select Wood Elf" }));
    expect(screen.getByRole("button", { name: "Change Race" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next: Class" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Change Race" }));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    await waitFor(() => expect(screen.getByRole("button", { name: "Change Race" })).toBeEnabled());
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("reports a fresh class selection failure through the real preview dialog", async () => {
    mocks.canonical.mockRejectedValueOnce(new Error("private server detail"));
    const fighter = { ...human, id: "fighter", name: "Fighter", slug: "fighter", content_type: "class", data: { hit_die: 10 } };
    render(<ClassStepClient characterId="char-1" character={character} classes={[fighter]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview Fighter" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick this class" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This class change could not be confirmed");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private server detail");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("announces failed background subchoices and exposes selection state", async () => {
    const background: ContentEntry = { ...human, id: "soldier", name: "Soldier", slug: "soldier", content_type: "background", effects: [{ type: "choice", choose: 1, from: ["skill-athletics", "skill-stealth"], grant_type: "proficiency", choice_id: "soldier-skill" }] };
    mocks.update.mockRejectedValueOnce(new Error("offline"));
    render(<BackgroundStepClient characterId="char-1" character={{ ...character, choices: { background: "soldier" } }} backgrounds={[background]} contentRefs={[{ id: "pin", content_id: "soldier", context: {}, choice_source: null, content_definitions: background }]} schema={undefined} />);
    expect(screen.getByRole("button", { name: "Athletics" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Athletics" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("background choices could not be confirmed");
    expect(screen.getByRole("button", { name: "Athletics" })).toHaveAttribute("aria-pressed", "false");
  });
  it("shows the pinned race's data and choices instead of a newer catalog revision", () => {
    const pin = { ...human, name: "Pinned Human", data: { description: "Authorized old description." }, effects: [{ type: "choice" as const, choose: 1, from: ["skill-athletics"], grant_type: "proficiency", choice_id: "old-human-skill" }] };
    const latest = { ...human, version: 2, data: { description: "New catalog description." }, effects: [{ type: "choice" as const, choose: 1, from: ["skill-stealth"], grant_type: "proficiency", choice_id: "new-human-skill" }] };
    render(<RaceStepClient characterId="char-1" character={{ ...character, choices: { race: "human" } }} races={[latest]} subraces={[]} traits={[]} contentRefs={[{ id: "pin", content_id: "human", context: {}, choice_source: null, content_definitions: pin }]} schema={undefined} />);
    expect(screen.getByText("Authorized old description.")).toBeInTheDocument();
    expect(screen.queryByText("New catalog description.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Athletics" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stealth" })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("keeps an authorized pinned race visible when it is absent from the current catalog", () => {
    render(<RaceStepClient characterId="char-1" character={{ ...character, choices: { race: "human" } }} races={[]} subraces={[]} traits={[]} contentRefs={[{ id: "pin", content_id: "human", context: {}, choice_source: null, content_definitions: human }]} schema={undefined} />);
    expect(screen.getByText("Human")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Race" })).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not display a subrace belonging to a different selected race as compatible", () => {
    race({ race: "human", subrace: "wood-elf" });
    expect(screen.getByRole("alert")).toHaveTextContent("does not belong");
    expect(screen.queryByRole("button", { name: "Change Subrace" })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("shows an existing pinned subrace even when no current catalog subraces remain", () => {
    const pin = { ...woodElf, data: { ...woodElf.data, description: "Pinned woodland heritage." } };
    render(<RaceStepClient characterId="char-1" character={{ ...character, choices: { race: "elf", subrace: "wood-elf" } }} races={[elf]} subraces={[]} traits={[]} contentRefs={[{ id: "pin", content_id: "wood-elf", context: {}, choice_source: null, content_definitions: pin }]} schema={undefined} />);
    expect(screen.getByText("Pinned woodland heritage.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Subrace" })).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not arbitrarily choose between conflicting saved snapshots", () => {
    const pins = [human, { ...human, name: "Other Human snapshot" }].map((content, index) => ({ id: "pin-" + index, content_id: "human", context: {}, choice_source: null, content_definitions: content }));
    render(<RaceStepClient characterId="char-1" character={{ ...character, choices: { race: "human" } }} races={[human]} subraces={[]} traits={[]} contentRefs={pins} schema={undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Multiple snapshots");
    expect(screen.getByRole("button", { name: "Preview Human" })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("uses pinned class and referenced feature snapshots in the actual level rail", () => {
    const pinnedFeature: ContentEntry = { ...human, id: "second-wind", slug: "second-wind", name: "Pinned Second Wind", content_type: "feature", data: { description: "Pinned recovery." } };
    const pinnedClass: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Pinned Fighter", content_type: "class", data: { hit_die: 10, levels: [{ level: 1, features: ["second-wind"] }] } };
    const pins = [pinnedClass, pinnedFeature].map(content => ({ id: "pin-" + content.id, content_id: content.id, context: {}, choice_source: null, content_definitions: content }));
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 1 }] } }} classes={[{ ...pinnedClass, name: "Catalog Fighter", version: 2, data: { hit_die: 12, levels: [] } }]} subclasses={[]} features={[{ ...pinnedFeature, name: "Catalog Second Wind", version: 2 }]} feats={[]} spells={[]} contentRefs={pins} schema={undefined} />);
    expect(screen.getAllByText("Pinned Fighter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pinned Second Wind").length).toBeGreaterThan(0);
    expect(screen.queryByText("Catalog Fighter")).not.toBeInTheDocument();
    expect(screen.queryByText("Catalog Second Wind")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("keeps a pinned class absent from the catalog visible in its level rail", () => {
    const pinnedClass: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Pinned Fighter", content_type: "class", data: { hit_die: 10, levels: [] } };
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 1 }] } }} classes={[]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[{ id: "pin", content_id: "fighter", context: {}, choice_source: null, content_definitions: pinnedClass }]} schema={undefined} />);
    expect(screen.getAllByText("Pinned Fighter").length).toBeGreaterThan(0);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not pick between conflicting pinned class definitions", () => {
    const pinnedClass: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Pinned Fighter", content_type: "class", data: { hit_die: 10, levels: [] } };
    const pins = [pinnedClass, { ...pinnedClass, version: 2 }].map((content, i) => ({ id: "pin-" + i, content_id: content.id, context: {}, choice_source: null, content_definitions: content }));
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 1 }] } }} classes={[pinnedClass]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={pins} schema={undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Multiple saved snapshots");
    expect(screen.queryByText("Pinned Fighter")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("shows the pinned subclass even when the catalog changes its parent and level features", () => {
    const cls: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Fighter", content_type: "class", data: { hit_die: 10, levels: [] } };
    const sub: ContentEntry = { ...human, id: "champion", slug: "champion", name: "Pinned Champion", content_type: "subclass", data: { parent_class: "fighter", levels: [] } };
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 3, subclass: "champion" }] } }} classes={[cls]} subclasses={[{ ...sub, name: "Catalog Champion", version: 2, data: { parent_class: "wizard", levels: [] } }]} features={[]} feats={[]} spells={[]} contentRefs={[{ id: "pin", content_id: sub.id, context: { source: "subclass", class: "fighter" }, choice_source: null, content_definitions: sub }]} schema={undefined} />);
    expect(screen.getAllByText("Pinned Champion").length).toBeGreaterThan(0);
    expect(screen.queryByText("Catalog Champion")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses editing a selected subclass belonging to another class", () => {
    const cls: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Fighter", content_type: "class", data: { hit_die: 10, levels: [] } };
    const sub: ContentEntry = { ...human, id: "champion", slug: "champion", name: "Wrong Champion", content_type: "subclass", data: { parent_class: "wizard", levels: [] } };
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 3, subclass: "champion" }] } }} classes={[cls]} subclasses={[sub]} features={[]} feats={[]} spells={[]} contentRefs={[{ id: "pin", content_id: sub.id, context: {}, choice_source: null, content_definitions: sub }]} schema={undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("does not belong");
    expect(screen.queryByRole("button", { name: /Remove Fighter/i })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks a second background subchoice while the first full-choice save is pending", async () => {
    let rejectSave!: (error: Error) => void;
    mocks.update.mockReturnValueOnce(new Promise<void>((_, reject) => { rejectSave = reject; }));
    const background: ContentEntry = { ...human, id: "soldier", name: "Soldier", slug: "soldier", content_type: "background", effects: [
      { type: "choice", choose: 1, from: ["skill-athletics"], grant_type: "proficiency", choice_id: "skill" },
      { type: "choice", choose: 1, from: ["tool-dice"], grant_type: "proficiency", choice_id: "tool" },
    ] };
    render(<BackgroundStepClient characterId="char-1" character={{ ...character, choices: { background: "soldier" } }} backgrounds={[background]} contentRefs={[{ id: "pin", content_id: background.id, context: {}, choice_source: null, content_definitions: background }]} schema={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Athletics" }));
    expect(screen.getByRole("button", { name: "Tool Dice" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tool Dice" }));
    expect(mocks.update).toHaveBeenCalledOnce();
    await act(async () => rejectSave(new Error("offline")));
    expect(screen.getByRole("button", { name: "Athletics" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Tool Dice" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(mocks.update.mock.calls[1][1].choices.resolved_choices).toEqual({ tool: ["tool-dice"] });
  });

});
