import { describe, expect, it } from "vitest";
import { resolvePinnedSpellSlots, resolveSpellSlots } from "@/lib/spells/helpers";
import { classDataSchema } from "@/lib/schemas/content-types/class";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

const slots = (...counts: number[]) => [...counts, ...Array(9 - counts.length).fill(0)];
const choice = (slug: string, level: number) => ({ slug, level });
// Original mechanical fixtures parsed through the actual class contract.
function profile(type: "full" | "half" | "third" | "pact" | null, level: number, row: number[] | null) {
  return classDataSchema.parse({ hit_die: 6, description: "Original local progression", spellcasting: type ? { type, ability: "intelligence" } : null,
    multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
    levels: [{ level, features: [], spellcasting: row === null ? null : { spell_slots: row } }], source_refs: [] });
}
describe("one validated slot resolution", () => {
  it.each([[1, null, {}], [2, slots(2), { "1": 2 }], [3, slots(3), { "1": 3 }], [5, slots(4, 2), { "1": 4, "2": 2 }], [9, slots(4, 3, 2), { "1": 4, "2": 3, "3": 2 }]] as const)("uses a single half-caster's own row at level %s", (level, row, expected) => {
    for (const slug of ["paladin", "ranger"]) expect(resolveSpellSlots([choice(slug, level)], { [slug]: profile("half", level, row === null ? null : [...row]) })).toEqual({ status: "available", maxSlots: expected, pactSlotLevel: null });
  });
  it("uses a custom third-caster's early unlock and sparse/reordered direct progression", () => {
    const data = profile("third", 1, slots(1));
    data.levels.unshift({ level: 7, features: [], spellcasting: { spell_slots: slots(4, 2) } });
    expect(resolveSpellSlots([choice("local-third", 1)], { "local-third": data })).toMatchObject({ status: "available", maxSlots: { "1": 1 } });
  });
  it("keeps noncasting and separately typed Pact Magic out of single-source regular weighting", () => {
    const data = { ranger: profile("half", 3, slots(3)), fighter: profile(null, 1, null), "local-pact": profile("pact", 3, slots(0, 2)) };
    expect(resolveSpellSlots([choice("ranger", 3), choice("fighter", 1), choice("local-pact", 3)], data)).toEqual({ status: "available", maxSlots: { "1": 3, pact: 2 }, pactSlotLevel: 2 });
  });
  it("retains weighted rounding for two regular sources", () => {
    expect(resolveSpellSlots([choice("paladin", 3), choice("wizard", 1)], { paladin: profile("half", 3, slots(3)), wizard: profile("full", 1, slots(2)) })).toEqual({ status: "available", maxSlots: { "1": 3 }, pactSlotLevel: null });
  });
  it("counts a nonnull cantrip-only row as active, but a null row as inactive", () => {
    const data = { custom: profile("third", 1, slots()), paladin: profile("half", 3, slots(3)) };
    expect(resolveSpellSlots([choice("custom", 1), choice("paladin", 3)], data)).toMatchObject({ status: "available", maxSlots: { "1": 2 } });
    data.custom.levels[0].spellcasting = null;
    expect(resolveSpellSlots([choice("custom", 1), choice("paladin", 3)], data)).toMatchObject({ status: "available", maxSlots: { "1": 3 } });
  });
  it("makes zero valid sources an available empty pool", () => {
    expect(resolveSpellSlots([], {})).toEqual({ status: "available", maxSlots: {}, pactSlotLevel: null });
    expect(resolveSpellSlots([choice("fighter", 1)], { fighter: profile(null, 1, null) })).toMatchObject({ status: "available", maxSlots: {} });
  });
  it("uses a full caster's direct row", () => {
    expect(resolveSpellSlots([choice("wizard", 5)], { wizard: profile("full", 5, slots(4, 3, 2)) })).toMatchObject({ status: "available", maxSlots: { "1": 4, "2": 3, "3": 2 } });
  });
  it.each([undefined, {}, { spellcasting: { type: "mystery", ability: "intelligence" }, levels: [] }, { spellcasting: null, levels: [] }, { spellcasting: null, levels: [{ spellcasting: null }] }, { spellcasting: null, levels: [{ level: 1 }] }, { spellcasting: null, levels: [{ level: 1, spellcasting: { spell_slots: slots(2) } }] }])("distinguishes missing/malformed profile or row from inactivity (%j)", data => {
    expect(resolveSpellSlots([choice("test", 1)], { test: data }).status).toBe("unavailable");
  });
  it.each([slots(-1), slots(1.5), slots(Infinity), slots(NaN), [2], Array(10).fill(0), Array(9)])("rejects malformed nine-slot rows %j", row => {
    const data = profile("full", 1, slots(2)); data.levels[0].spellcasting!.spell_slots = row;
    expect(resolveSpellSlots([choice("test", 1)], { test: data }).status).toBe("unavailable");
  });
  it.each([0, 21, 1.5, NaN, "1"])("rejects invalid selected class level %s", level => {
    expect(resolveSpellSlots([{ slug: "test", level }], { test: profile("full", 1, slots(2)) }).status).toBe("unavailable");
  });
  it("rejects duplicate selected rows and class choices", () => {
    const data = profile("full", 1, slots(2)); data.levels.push(data.levels[0]);
    expect(resolveSpellSlots([choice("test", 1)], { test: data }).status).toBe("unavailable");
    expect(resolveSpellSlots([choice("test", 1), choice("test", 1)], { test: profile("full", 1, slots(2)) }).status).toBe("unavailable");
  });
  it("rejects ambiguous pact levels/sources; zero pact row has no fabricated level", () => {
    expect(resolveSpellSlots([choice("p", 3)], { p: profile("pact", 3, slots(1, 2)) }).status).toBe("unavailable");
    expect(resolveSpellSlots([choice("p", 3), choice("q", 3)], { p: profile("pact", 3, slots(0, 2)), q: profile("pact", 3, slots(0, 2)) }).status).toBe("unavailable");
    expect(resolveSpellSlots([choice("p", 3)], { p: profile("pact", 3, slots()) })).toEqual({ status: "available", maxSlots: {}, pactSlotLevel: null });
  });
});

describe("selected exact pin evidence", () => {
  const character = { id: "character", system_id: "system" };
  const ref = () => ({ character_id: "character", content_id: "class-id", content_version: 2,
    content_definitions: { id: "class-id", version: 2, system_id: "system", content_type: "class", slug: "test", owner_id: "other-author", data: profile("half", 3, slots(3)) } }) as unknown as ContentRefWithContent;
  it("uses a readable historical pin without requiring the author to be the viewer", () => expect(resolvePinnedSpellSlots([choice("test", 3)], [ref()], character)).toMatchObject({ status: "available", maxSlots: { "1": 3 } }));
  it.each(["missing", "duplicate", "version", "id", "character", "system"])("rejects %s evidence", problem => {
    const row = ref();
    if (problem === "version") row.content_version = 1;
    if (problem === "id") row.content_id = "another";
    if (problem === "character") row.character_id = "another";
    if (problem === "system") row.content_definitions.system_id = "another";
    const refs = problem === "missing" ? [] : problem === "duplicate" ? [row, ref()] : [row];
    expect(resolvePinnedSpellSlots([choice("test", 3)], refs, character).status).toBe("unavailable");
  });
});
