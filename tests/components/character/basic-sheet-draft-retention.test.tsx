import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacterState } from "@/lib/character/character-context";
import { CharacterShell } from "@/components/character/character-shell";
import { TimelineSection } from "@/components/narrative/timeline-section";
import { createTimelineEvent, readTimelineEvent } from "@/app/(app)/characters/[id]/story-actions";
import { updateManualHpState } from "@/lib/sheet/update-state";
import { providerAbilities, providerBase, providerCharacterId, providerRaceRef, providerSources, providerSystemId } from "../../fixtures/provider-mechanics";
import { pinnedSlotClass } from "../../fixtures/pinned-slot-class";
import type { CharacterWithSystem } from "@/lib/types/character";

vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn(), updateManualHpState: vi.fn() }));
vi.mock("@/app/(app)/characters/[id]/story-actions", () => ({ createTimelineEvent: vi.fn(), readTimelineEvent: vi.fn(), updateTimelineEvent: vi.fn(), deleteTimelineEvent: vi.fn() }));
vi.mock("@/components/editor/rich-text-editor", () => ({ RichTextEditor: () => <div /> }));
vi.mock("@/components/editor/rich-text-renderer", () => ({ RichTextRenderer: () => <div /> }));
vi.mock("@/components/character/sheet-panel", () => ({ SheetPanel: () => <SheetControl /> }));
vi.mock("@/components/character/narrative-panel", () => ({ NarrativePanel: () => <TimelineSection characterId={providerCharacterId} events={[]} isOwner /> }));
vi.mock("@/components/sheet/character-header", () => ({ CharacterHeader: () => null }));
vi.mock("@/components/sheet/first-arrival", () => ({ FirstArrival: () => null }));
vi.mock("@/components/sheet/spells/concentration-badge", () => ({ ConcentrationBadge: () => null }));
vi.mock("@/components/sheet/concentration-prompt", () => ({ ConcentrationPrompt: () => null }));
vi.mock("@/components/sheet/rolls/roll-layer", () => ({ RollLayer: () => null }));

function SheetControl() {
  const { state, patchActionState, reloadRequired } = useCharacterState();
  return <><output aria-label="Confirmed HP">{state.current_hp}</output>
    <button disabled={reloadRequired} onClick={() => { void patchActionState({ current_hp: 20 }).catch(() => {}); }}>Selected HP edit</button></>;
}
const owner = "11111111-1111-4111-8111-111111111111";
const schema = { ability_scores: providerAbilities, proficiency_levels: [], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
  derived_stats: [{ slug: "proficiency_bonus", base: 2 }] };
const bard = pinnedSlotClass("bard", 3, "full", [4, 2, 0, 0, 0, 0, 0, 0, 0], providerCharacterId, providerSystemId);
const refs = [bard, providerRaceRef("human")];
const raw = { current_hp: 24, temp_hp: 0, quick_notes: "keep" };
const character = { id: providerCharacterId, user_id: owner, system_id: providerSystemId, name: "Selected Bard", level: 3, campaign_id: null,
  archived: false, action_revision: "11", state: raw, choices: { classes: [{ slug: "bard", level: 3 }], race: "human", ability_method: "manual" },
  base_stats: { ...providerBase, constitution: 14, charisma: 15 }, narrative: {}, narrative_rich: {},
  game_systems: { id: providerSystemId, slug: "dnd-5e-2014", name: "2014", schema_definition: schema } } as unknown as CharacterWithSystem;
function Fixture({ refreshed = false, mismatch = false, changedSchema = false }: { refreshed?: boolean; mismatch?: boolean; changedSchema?: boolean }) {
  const loaded = refreshed ? { ...character, action_revision: "12", state: { ...raw, current_hp: mismatch ? 19 : 20 } } : character;
  const loadedSchema = changedSchema ? { ...schema, derived_stats: [{ slug: "proficiency_bonus", base: 3 }] } : schema;
  return <CharacterProvider character={loaded} schema={loadedSchema as never} contentRefs={refs} contentSnapshotsComplete nativeManualHp
    initialState={loaded.state} initialInventory={[]} initialSpells={[]} classData={{ bard: { slug: "bard", data: bard.content_definitions.data } } as never}
    allEffects={[]} baseStatsWithLevel={{ ...loaded.base_stats, level: 3 }} structuredSources={providerSources(loaded, refs)}
    isOwner isDm={false} hasSheet maxHp={24} primaryColor={null} onPrimaryColorChange={() => {}}>
    <CharacterShell campaignPageBacklinks={[]} timelineEvents={[]} relationships={[]} />
  </CharacterProvider>;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(updateManualHpState).mockResolvedValue({ status: "applied", character_id: providerCharacterId, actor_id: owner,
    revision: "12", state: { ...raw, current_hp: 20 }, campaign_id: null });
  vi.mocked(readTimelineEvent).mockResolvedValue({ status: "unknown", error: "Read unavailable" });
});
afterEach(cleanup);
describe("real shell tabs/provider refresh retain the mounted Journal editor; persistence is simulated", () => {
  it.each(["unknown", "pending"])("retains %s create attempt and draft across tabs and a coherent HP read", async outcome => {
    let resolveCreate!: (value: { status: "unknown"; error: string }) => void;
    vi.mocked(createTimelineEvent).mockImplementation(() => outcome === "pending"
      ? new Promise(resolve => { resolveCreate = resolve; }) : Promise.resolve({ status: "unknown", error: "Response lost" }));
    const view = render(<Fixture />);
    fireEvent.click(screen.getByRole("tab", { name: "Narrative" }));
    fireEvent.click(screen.getByRole("button", { name: "Write entry" }));
    fireEvent.change(screen.getByLabelText("Entry title"), { target: { value: "Draft stays here" } });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => expect(createTimelineEvent).toHaveBeenCalledOnce());
    const attempt = vi.mocked(createTimelineEvent).mock.calls[0][1].entryId;
    expect(attempt).toMatch(/^[a-f0-9-]{36}$/);
    fireEvent.click(screen.getByRole("tab", { name: "Character Sheet" }));
    const hidden = screen.getByLabelText("Entry title").closest('[role="tabpanel"]');
    expect(hidden).toHaveAttribute("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Selected HP edit" }));
    await waitFor(() => expect(screen.getByLabelText("Confirmed HP")).toHaveTextContent("20"));
    expect(updateManualHpState).toHaveBeenCalledOnce();
    view.rerender(<Fixture refreshed />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Selected HP edit" })).toBeEnabled());
    fireEvent.click(screen.getByRole("tab", { name: "Narrative" }));
    expect(screen.getByLabelText("Entry title")).toHaveValue("Draft stays here");
    expect(screen.getByRole("button", { name: outcome === "pending" ? "Saving…" : "Save entry" })).toBeDisabled();
    if (outcome === "pending") resolveCreate({ status: "unknown", error: "Response lost" });
    const check = await screen.findByRole("button", { name: "Check saved entry" });
    await waitFor(() => expect(check).toBeEnabled());
    fireEvent.click(check);
    await waitFor(() => expect(readTimelineEvent).toHaveBeenCalledWith(providerCharacterId, attempt));
    expect(createTimelineEvent).toHaveBeenCalledOnce();
  });
  it.each(["state", "schema"])("requires reload on a fresh revision whose %s binding mismatches", async mismatch => {
    const view = render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "Selected HP edit" }));
    await waitFor(() => expect(updateManualHpState).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByLabelText("Confirmed HP")).toHaveTextContent("20"));
    view.rerender(<Fixture refreshed mismatch={mismatch === "state"} changedSchema={mismatch === "schema"} />);
    expect(await screen.findByText("The refreshed mechanical inputs could not be confirmed. Reload before another action.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Selected HP edit" })).toBeDisabled();
    expect(screen.getByLabelText("Confirmed HP")).toHaveTextContent("20");
  });
});
