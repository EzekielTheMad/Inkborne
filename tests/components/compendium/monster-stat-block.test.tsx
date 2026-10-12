import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonsterStatBlock } from "@/components/compendium/monster-stat-block";
import { CompendiumDetail } from "@/components/compendium/compendium-detail";
import { monsterDataSchema } from "@/lib/schemas/content-types/monster";
import type { CompendiumEntry } from "@/lib/compendium/types";
import { cinderlitKite, glassrootSentinel, lanternReefRegent, monsterEnvelope, monsterWithBytes } from "@/tests/fixtures/monsters";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";

describe("read-only monster rendering", () => {
  it("renders declared zeros/negative bonuses once and does not recompute HP/damage", () => {
    render(<MonsterStatBlock data={monsterDataSchema.parse(cinderlitKite)} />);
    expect(screen.getByText("12 (woven shell)")).toBeVisible();
    expect(screen.getByText("18 (3d6 + 8)")).toBeVisible();
    expect(screen.getByText("Walk 0 ft., Fly 30 ft. (hover)")).toBeVisible();
    expect(screen.getByText("Strength -1, Wisdom +0")).toBeVisible();
    expect(screen.getByText("8 (-1)")).toBeVisible();
    expect(screen.getByText("Ranged weapon attack: +0 to hit; range 20 / 40 ft.; one target")).toBeVisible();
    expect(screen.getByText("Damage: 2 (1d4) bludgeoning")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Legendary Actions" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Lair Actions" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("renders all optional summaries, duplicate ordered actions and initiative zero", () => {
    render(<MonsterStatBlock data={monsterDataSchema.parse(lanternReefRegent)} />);
    expect(screen.getByText("Passive Perception 0", { exact: false })).toBeVisible();
    expect(screen.getByText("9 (0 XP)")).toBeVisible();
    expect(screen.getByText("Constitution save DC 0; on success: The glass stays clear.")).toBeVisible();
    expect(screen.getByText("Damage: 0 (1d6) radiant (A dim pulse.)")).toBeVisible();
    expect(screen.getByText("Initiative count: 0")).toBeVisible();
    expect(screen.getByRole("heading", { name: /^Old light\s*\(Cost 2\)$/, level: 3 })).toBeVisible();
    const actions = within(screen.getByRole("region", { name: "Actions" }));
    expect(actions.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Lantern pulse", "Lantern pulse"]);
    const descriptions = actions.getAllByText(/light.*pulse\./).map((node) => node.textContent);
    expect(descriptions).toEqual(["A close light releases a soft pulse.", "A distant light replies with a different pulse."]);
    for (const section of ["Traits", "Bonus Actions", "Reactions", "Legendary Actions", "Lair Actions"]) expect(screen.getByRole("region", { name: section })).toBeVisible();
    expect(screen.queryByText(/Fly 0 ft. \(hover\)/)).toBeNull();
  });
  it("renders skills, defenses and save-only actions without assuming default results", () => {
    render(<MonsterStatBlock data={glassrootSentinel} />);
    expect(screen.getByText("Perception +0, Glasswork -2")).toBeVisible();
    expect(screen.getByText("Damage Vulnerabilities")).toBeVisible();
    expect(screen.getByText("thunder")).toBeVisible();
    expect(screen.getByText("Damage: 9 (2d6 + 2) bludgeoning; 0 cold")).toBeVisible();
    expect(screen.getByText("Wisdom save DC 12; on success: The creature keeps moving.")).toBeVisible();
    expect(screen.queryByText(/half damage/)).toBeNull();
  });
  it("escapes untrusted text rather than creating HTML, handlers, formulas or links", () => {
    const injection = '<script>globalThis.compromised=true</script><img src=x onerror="alert(1)"> javascript:alert(1)';
    const data = monsterDataSchema.parse({ ...cinderlitKite, actions: [{ name: injection, description: injection,
      damage: [{ type: "cold", roll_text: "globalThis.compromised = true" }] }] });
    const { container } = render(<MonsterStatBlock data={data} />);
    expect(screen.getAllByText(injection)).toHaveLength(2);
    expect(container.querySelector("script,img,a,[onerror]")).toBeNull();
    expect(screen.getByText("Damage: globalThis.compromised = true cold")).toBeVisible();
    expect(Object.hasOwn(globalThis, "compromised")).toBe(false);
  });
  it("uses the real detail shell and retains provenance/content revision/return query", () => {
    const row = { ...monsterEnvelope(), version: 7, scope: "shared", effects: [{ type: "mechanical", stat: "armor_class", op: "add", value: 99 }] };
    const entry = parseContentDefinition(row) as CompendiumEntry;
    const returnHref = "/library?category=monsters&size=Small&page=2";
    render(<CompendiumDetail entry={entry} userId="44444444-4444-4444-8444-444444444444" returnHref={returnHref} />);
    expect(screen.getByRole("heading", { name: "Cinderlit Kite", level: 1 })).toBeVisible();
    expect(screen.getByText("Campaign shared")).toBeVisible();
    expect(screen.getByText("Version 7")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Library" })).toHaveAttribute("href", returnHref);
    expect(screen.getByText("12 (woven shell)")).toBeVisible();
    expect(screen.queryByText("111 (woven shell)")).toBeNull();
    expect(screen.getByText("This stat block is read-only.")).toBeVisible();
    expect(screen.queryByText(/Manage content you own/)).toBeNull();
  });
  it("keeps absent description omitted and fails closed on malformed direct detail props", () => {
    const row = monsterEnvelope();
    delete row.data.description;
    const { rerender } = render(<CompendiumDetail entry={parseContentDefinition(row) as CompendiumEntry} userId={row.owner_id} returnHref="/library" />);
    expect(screen.queryByRole("heading", { name: "Description" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Statistics" })).toBeVisible();
    rerender(<CompendiumDetail entry={{ ...row, data: {} }} userId={row.owner_id} returnHref="/library" />);
    expect(screen.getByText("Stat block unavailable.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Statistics" })).toBeNull();
  });
  it("retains every rule and final description at the valid aggregate boundary", () => {
    const data = monsterDataSchema.parse(monsterWithBytes(65_536));
    render(<MonsterStatBlock data={data} />);
    const traits = screen.getByRole("region", { name: "Traits" });
    expect(within(traits).getAllByRole("heading", { level: 3 })).toHaveLength(20);
    expect(within(traits).getByRole("heading", { name: "Lantern memory 19" })).toBeVisible();
    expect(traits.textContent).toContain(data.traits![19].description);
  });
});
