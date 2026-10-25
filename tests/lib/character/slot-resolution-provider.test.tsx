import { providerAbilities, providerBase, providerSources, providerCharacterId, providerSystemId } from "../../fixtures/provider-mechanics";
import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useRest, useSpells } from "@/lib/character/character-context";
import { SlotTracker } from "@/components/sheet/spells/slot-tracker";
import { RestDialog } from "@/components/sheet/rest-dialog";
import { CharacterPrintAction } from "@/components/sheet/character-print-action";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { addCharacterSpell } from "@/lib/supabase/spells";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { pinnedSlotClass } from "../../fixtures/pinned-slot-class";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { CharacterSpell } from "@/lib/types/spells";

vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn() }));
vi.mock("@/lib/builder/use-is-mobile", () => ({ useIsMobile: () => false }));

let spells: ReturnType<typeof useSpells>;
let rest: ReturnType<typeof useRest>;
const schema = { ability_scores: providerAbilities, proficiency_levels: [], derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 2 }, { slug: "initiative", name: "Initiative", base: 0 }], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
const cantrip = { id: "spell", name: "Original Spark", class_slug: "paladin", is_known: true, content_definitions: { slug: "original-spark", data: { level: 0, school: "evocation", components: [], range: "30 feet", casting_time: "1 action" } } } as unknown as CharacterSpell;
function Probe({ dialogs }: { dialogs: boolean }) {
  const currentSpells = useSpells(), currentRest = useRest();
  useEffect(() => { spells = currentSpells; rest = currentRest; }, [currentSpells, currentRest]);
  return <><SlotTracker /><CharacterPrintAction />{dialogs && <><RestDialog open onClose={() => {}} /><CastDialog open spell={cantrip} castability="full" onClose={() => {}} /></>}</>;
}
function fixture(refs: ContentRefWithContent[], choices = [{ slug: "paladin", level: 3 }], dialogs = false) {
  const level = choices.reduce((sum, entry) => sum + entry.level, 0);
  const character = { id: providerCharacterId, system_id: providerSystemId, user_id: "owner", name: "Local Caster", level, choices: { classes: choices }, state: {}, base_stats: providerBase, narrative: {} };
  return render(<CharacterProvider character={character as never}
    schema={schema as never} contentRefs={refs} contentSnapshotsComplete initialState={{ current_hp: 12, temp_hp: 0, spell_slots_used: { "1": 1, pact: 1 } }} initialInventory={[]} initialSpells={[]}
    classData={Object.fromEntries(refs.map(ref => [ref.content_definitions.slug, { slug: ref.content_definitions.slug, data: ref.content_definitions.data }])) as never}
    allEffects={[]} baseStatsWithLevel={{ ...providerBase, level }} structuredSources={providerSources(character, refs)} isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}><Probe dialogs={dialogs} /></CharacterProvider>);
}
beforeEach(() => { vi.clearAllMocks(); });
describe("real provider slot evidence and action guards", () => {
  it("exposes one direct half-caster snapshot to tracker, rest and print", () => {
    fixture([pinnedSlotClass("paladin", 3, "half", [3, 0, 0, 0, 0, 0, 0, 0, 0], providerCharacterId, providerSystemId)]);
    expect(spells.slotResolution).toEqual({ status: "available", maxSlots: { "1": 3 }, pactSlotLevel: null });
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(rest.canLongRest).toBe(true);
    expect(screen.getByRole("button", { name: "Print / Save PDF", hidden: true })).toBeEnabled();
  });
  it("resolves custom Pact Magic with one regular source from the same numbered snapshot", () => {
    fixture([pinnedSlotClass("paladin", 3, "half", [3, 0, 0, 0, 0, 0, 0, 0, 0], providerCharacterId, providerSystemId), pinnedSlotClass("local-pact", 3, "pact", [0, 2, 0, 0, 0, 0, 0, 0, 0], providerCharacterId, providerSystemId)], [{ slug: "paladin", level: 3 }, { slug: "local-pact", level: 3 }]);
    expect(spells.slotResolution).toEqual({ status: "available", maxSlots: { "1": 3, pact: 2 }, pactSlotLevel: 2 });
    expect(spells.pactSlotLevel).toBe(2);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });
  it("leaves valid noncasters able to execute a normal atomic rest", async () => {
    fixture([pinnedSlotClass("fighter", 3, null, null, providerCharacterId, providerSystemId)], [{ slug: "fighter", level: 3 }]);
    expect(spells.slotResolution).toEqual({ status: "available", maxSlots: {}, pactSlotLevel: null });
    await act(async () => expect(await rest.longRest()).toBe(true));
    expect(updateCharacterState).toHaveBeenCalledTimes(1);
  });
  it.each(["missing", "duplicate", "malformed", "wrong-version"])("blocks cast/rest/tracker/print when %s evidence is unresolved", async kind => {
    const ref = pinnedSlotClass("paladin", 3, "half", [3, 0, 0, 0, 0, 0, 0, 0, 0], providerCharacterId, providerSystemId);
    if (kind === "wrong-version") ref.content_version = 2;
    if (kind === "malformed") (ref.content_definitions.data as { levels: unknown[] }).levels = [{ level: 3 }];
    fixture(kind === "missing" ? [] : kind === "duplicate" ? [ref, ref] : [ref], undefined, true);
    expect(spells.slotResolution.status).toBe("unavailable");
    expect(rest.arcaneRecovery.available).toBe(false);
    expect(screen.getByRole("button", { name: "Print / Save PDF", hidden: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Take Short Rest", hidden: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Take Long Rest", hidden: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Cast/, hidden: true })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Mark 1st slot used" })).not.toBeInTheDocument();
    await expect(spells.castSpell(cantrip, { type: "cantrip" })).rejects.toThrow(/unavailable/);
    await expect(rest.shortRest()).resolves.toBe(false);
    await expect(rest.longRest()).resolves.toBe(false);
    await expect(spells.addSpell({ content_id: "spell-pin", content_version: 1, name: "Original", class_slug: "paladin" })).rejects.toThrow(/unavailable/);
    expect(addCharacterSpell).not.toHaveBeenCalled();
    expect(updateCharacterState).not.toHaveBeenCalled();
  });
});
