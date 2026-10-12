import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatPreview } from "@/components/builder/stat-preview";
import { raceDataSchema } from "@/lib/schemas/content-types/race";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { evaluate } from "@/lib/engine/evaluator";
import { raceWalkingEffect } from "@/lib/homebrew/race-authoring";

// Actual repository 2014 system config; no SQL execution or hosted fixture.
const seed = readFileSync(path.join(process.cwd(), "supabase/seed.sql"), "utf8");
const seedJson = seed.slice(seed.indexOf("'dnd-5e-2014'" )).match(/'(\{[\s\S]*?\})'::jsonb/)?.[1];
if (!seedJson) throw new Error("Canonical 2014 seed schema unavailable");
const schema = systemSchemaDefinitionSchema.parse(JSON.parse(seedJson.replace(/''/g, "'")));
const base = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, level: 1, hit_die_total: 8, spellcasting_ability: 10 };
function row(speed: number, version: number) {
  return { id: "11111111-1111-4111-8111-111111111111", system_id: "22222222-2222-4222-8222-222222222222", slug: "aster-kin", name: "Aster Kin",
    content_type: "race", source: "homebrew", scope: "personal", owner_id: "33333333-3333-4333-8333-333333333333", version,
    data: raceDataSchema.parse({ size: "Medium", speed, speed_detail: { walk: speed } }), effects: [raceWalkingEffect(speed)] };
}
describe("core race real consumer parity", () => {
  it("exposes the metadata-only walking mismatch and resolves it with the derived effect", () => {
    const definition = parseContentDefinition({ ...row(40, 1), effects: [] });
    if (!definition) throw new Error("Expected valid synthetic metadata-only race");
    const sources = buildCharacterStructuredSources([{ content_definitions: definition }], 1);
    const before = evaluate(base, definition.effects, schema, sources);
    expect(before.speed.walk).toBe(40);
    expect(before.computed.movement_speed).toBe(30);
    const view = render(<StatPreview baseStats={base} effects={definition.effects} schema={schema} level={1} />);
    expect(screen.getByText("Speed").nextElementSibling).toHaveTextContent("30");
    const authored = [raceWalkingEffect(40)];
    const after = evaluate(base, authored, schema, sources);
    expect(after.speed.walk).toBe(40);
    expect(after.computed.movement_speed).toBe(40);
    view.rerender(<StatPreview baseStats={base} effects={authored} schema={schema} level={1} />);
    expect(screen.getByText("Speed").nextElementSibling).toHaveTextContent("40");
  });
  it("runs canonical definition/snapshot parsing through live sources/evaluator and actual StatPreview", () => {
    const raw = row(40, 1);
    const definition = parseContentDefinition(raw);
    const pin = parseContentVersionSnapshot({ content_id: raw.id, version: 1, system_id_snapshot: raw.system_id,
      content_type_snapshot: "race", slug_snapshot: raw.slug, name_snapshot: raw.name, data_snapshot: raw.data, effects_snapshot: raw.effects,
      source_snapshot: raw.source, scope_snapshot: raw.scope, owner_id_snapshot: raw.owner_id });
    expect(pin).not.toBeNull(); expect(pin?.data).toEqual(definition?.data);
    if (!pin) throw new Error("Expected valid synthetic pin");
    const live = evaluate(base, pin.effects, schema, buildCharacterStructuredSources([{ content_definitions: pin }], 1));
    expect(live.speed.walk).toBe(40);
    expect(live.computed.movement_speed).toBe(40);
    expect(live.stats.strength).toBe(10);
    expect(pin.effects.some((effect) => effect.type === "mechanical" && effect.stat === "size")).toBe(false);
    render(<StatPreview baseStats={base} effects={pin.effects} schema={schema} level={1} />);
    expect(screen.getByText("Speed").nextElementSibling).toHaveTextContent("40");
    expect(pin.data.size).toBe("Medium");
    expect(parseContentDefinition(row(55, 2))?.data.speed).toBe(55);
    expect(pin.version).toBe(1); expect(pin.data.speed).toBe(40);
  });
});
