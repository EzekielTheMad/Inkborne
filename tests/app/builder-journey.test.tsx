import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import BuilderLayout from "@/app/(app)/characters/[id]/builder/layout";
import BuilderOverviewPage from "@/app/(app)/characters/[id]/builder/page";
import { createClient } from "@/lib/supabase/server";
import { getBuilderStepStatus } from "@/lib/builder/step-status";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import type { CharacterChoices } from "@/lib/types/character";

const navigation = vi.hoisted(() => ({ pathname: "/characters/char-1/builder" }));
vi.mock("@/lib/supabase/content-refs", () => ({ getContentRefsByCharacter: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  notFound: vi.fn(() => { throw new Error("notFound"); }),
}));

const steps = ["class", "race", "background", "abilities", "equipment"].map((type, index) => ({
  step: index + 1, type, label: type[0].toUpperCase() + type.slice(1),
}));

function mockCharacter(choices: CharacterChoices, baseStats: Record<string, number> = {}, owner = "user-1", user: object | null = { id: "user-1" }) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {
      id: "char-1", name: "New adventurer", user_id: owner, choices, base_stats: baseStats,
      game_systems: { schema_definition: { creation_steps: steps, ability_scores: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug, name: slug, abbr: slug })) } },
    }, error: null }),
  };
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue(query),
  } as never);
  return query;
}

const selected: CharacterChoices = {
  classes: [{ slug: "fighter", level: 1 }], race: "human", background: "soldier",
  ability_method: "standard_array",
};
const pins = [
  { slug: "fighter", content_type: "class" }, { slug: "human", content_type: "race" }, { slug: "soldier", content_type: "background" },
].map(definition => ({ content_id: definition.slug, content_version: 1, content_definitions: { ...definition, id: definition.slug, name: definition.slug, version: 1, source: "srd" as const, data: {}, effects: [] } }));
const scores = { strength: 15, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 };

describe("local builder journey", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getContentRefsByCharacter).mockResolvedValue(pins as never); navigation.pathname = "/characters/char-1/builder"; });

  it.each([
    { name: "fresh character", choices: {}, stats: {}, labels: ["Not started", "Not started", "Not started", "Not started", "Not started"] },
    { name: "ability method selected", choices: { ability_method: "standard_array" }, stats: {}, labels: ["Not started", "Not started", "Not started", "In progress", "Not started"] },
    { name: "saved core choices", choices: selected, stats: scores, labels: ["Complete", "Complete", "Complete", "Complete", "Not started"] },
    { name: "partial abilities", choices: selected, stats: { strength: 15 }, labels: ["Complete", "Complete", "Complete", "In progress", "Not started"] },
    { name: "equipment draft", choices: { ...selected, starting_equipment: { selections: {}, picks: {} } }, stats: scores, labels: ["Complete", "Complete", "Complete", "Complete", "In progress"] },
    { name: "missing saved pins", choices: selected, stats: scores, refs: [], labels: ["In progress", "In progress", "In progress", "Complete", "Not started"] },
    { name: "duplicate race pin", choices: selected, stats: scores, refs: [...pins, pins[1]], labels: ["Complete", "In progress", "Complete", "Complete", "Not started"] },
    { name: "wrong background identity", choices: selected, stats: scores, refs: pins.map(pin => pin.content_id === "soldier" ? { ...pin, content_id: "wrong-id" } : pin), labels: ["Complete", "Complete", "In progress", "Complete", "Not started"] },
    { name: "mismatched race version", choices: selected, stats: scores, refs: pins.map(pin => pin.content_id === "human" ? { ...pin, content_version: 2 } : pin), labels: ["Complete", "In progress", "Complete", "Complete", "Not started"] },
    { name: "extra stale class pin", choices: selected, stats: scores, refs: [...pins, { ...pins[0], content_id: "bard", content_definitions: { ...pins[0].content_definitions, id: "bard", slug: "bard" } }], labels: ["In progress", "Complete", "Complete", "Complete", "Not started"] },
    { name: "incompatible selected subrace", choices: { ...selected, subrace: "wood-elf" }, stats: scores, refs: [...pins, { content_id: "wood-elf", content_version: 1, content_definitions: { ...pins[1].content_definitions, id: "wood-elf", slug: "wood-elf", content_type: "subrace", data: { parent_race: "elf" } } }], labels: ["Complete", "In progress", "Complete", "Complete", "Not started"] },
    { name: "missing selected subclass pin", choices: { ...selected, classes: [{ slug: "fighter", level: 3, subclass: "champion" }] }, stats: scores, labels: ["In progress", "Complete", "Complete", "Complete", "Not started"] },
    { name: "invalid saved class level", choices: { ...selected, classes: [{ slug: "fighter", level: 0 }] }, stats: scores, labels: ["In progress", "Complete", "Complete", "Complete", "Not started"] },
    { name: "equipment confirmed", choices: { ...selected, starting_equipment: { selections: {}, picks: {}, confirmed: true } }, stats: scores, labels: ["Complete", "Complete", "Complete", "Complete", "Complete"] },
  ])("keeps overview and navigation aligned for $name", async ({ choices, stats, labels, refs }) => {
    if (refs) vi.mocked(getContentRefsByCharacter).mockResolvedValue(refs as never);
    mockCharacter(choices as CharacterChoices, stats as Record<string, number>);
    const overview = await BuilderOverviewPage({ params: Promise.resolve({ id: "char-1" }) });
    render(await BuilderLayout({ params: Promise.resolve({ id: "char-1" }), children: overview }));
    const nav = screen.getByRole("navigation", { name: "Character builder" });
    steps.forEach((step, index) => {
      const links = screen.getAllByRole("link", { name: new RegExp(`${step.label}.*${labels[index]}`) });
      expect(links).toHaveLength(2);
      links.forEach((link) => expect(link).toHaveAttribute("href", `/characters/char-1/builder/${step.type}`));
    });
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    screen.getAllByRole("link", { name: "View Character" }).forEach((link) => expect(link).toHaveAttribute("href", "/characters/char-1"));
    expect(screen.queryByText("Back to Dashboard")).not.toBeInTheDocument();
  });

  it.each([
    { name: "missing required choice", resolved: {} as Record<string, string[]>, status: "In progress" },
    { name: "duplicate selections", resolved: { "soldier-skills": ["skill-athletics", "skill-athletics"] }, status: "In progress" },
    { name: "out-of-snapshot selection", resolved: { "soldier-skills": ["skill-athletics", "skill-stealth"] }, status: "In progress" },
    { name: "saved explicit choices", resolved: { "soldier-skills": ["skill-athletics", "skill-intimidation"] }, status: "Complete" },
  ])("validates pinned background choice in overview/navigation: $name", async ({resolved,status}) => {
    const refs = pins.map(pin => pin.content_id === "soldier" ? { ...pin, content_definitions: { ...pin.content_definitions, effects: [{ type: "choice", choose: 2, from: ["skill-athletics", "skill-intimidation"], grant_type: "proficiency", choice_id: "soldier-skills" }] } } : pin);
    vi.mocked(getContentRefsByCharacter).mockResolvedValue(refs as never);
    mockCharacter({...selected,resolved_choices:resolved},scores);
    const overview = await BuilderOverviewPage({params:Promise.resolve({id:"char-1"})});
    render(await BuilderLayout({params:Promise.resolve({id:"char-1"}),children:overview}));
    expect(screen.getAllByRole("link",{name:new RegExp(`Background.*${status}`)})).toHaveLength(2);
  });

  it.each([
    {type:"race",slug:"human",step:"Race",choices:selected},
    {type:"class",slug:"fighter",step:"Class",choices:selected},
    {type:"subrace",slug:"wood-elf",step:"Race",choices:{...selected,subrace:"wood-elf"},parent:{parent_race:"human"}},
    {type:"subclass",slug:"champion",step:"Class",choices:{...selected,classes:[{slug:"fighter",level:3,subclass:"champion"}]},parent:{parent_class:"fighter"}},
  ])("checks explicit choices on pinned $type", async ({type,slug,step,choices,parent}) => {
    const choice = {type:"choice" as const,choose:1,from:["skill-athletics"],grant_type:"proficiency",choice_id:"required-skill"};
    const definition = {id:slug,slug,content_type:type,name:slug,version:1,source:"srd" as const,data:parent??{},effects:[choice]};
    const refs = [...pins.filter(pin=>pin.content_definitions.content_type!==type),{content_id:slug,content_version:1,content_definitions:definition}];
    vi.mocked(getContentRefsByCharacter).mockResolvedValue(refs as never);
    mockCharacter(choices,scores);
    const overview = await BuilderOverviewPage({params:Promise.resolve({id:"char-1"})});
    const rendered=render(await BuilderLayout({params:Promise.resolve({id:"char-1"}),children:overview}));
    expect(screen.getAllByRole("link",{name:new RegExp(`${step}.*In progress`)})).toHaveLength(2);
    rendered.unmount();
    mockCharacter({...choices,resolved_choices:{"required-skill":["skill-athletics"]}},scores);
    const completed=await BuilderOverviewPage({params:Promise.resolve({id:"char-1"})});
    render(await BuilderLayout({params:Promise.resolve({id:"char-1"}),children:completed}));
    expect(screen.getAllByRole("link",{name:new RegExp(`${step}.*Complete`)})).toHaveLength(2);
  });

  it("identifies the active step accessibly", async () => {
    navigation.pathname = "/characters/char-1/builder/abilities";
    mockCharacter(selected, scores);
    render(await BuilderLayout({ params: Promise.resolve({ id: "char-1" }), children: null }));
    expect(screen.getByRole("link", { name: /Abilities: Complete/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("redirects unauthenticated entry before fetching a character", async () => {
    const query = mockCharacter({}, {}, "user-1", null);
    await expect(BuilderLayout({ params: Promise.resolve({ id: "char-1" }), children: null })).rejects.toThrow("redirect:/login");
    expect(query.single).not.toHaveBeenCalled();
    expect(getContentRefsByCharacter).not.toHaveBeenCalled();
  });

  it("rejects another user's character at the layout boundary", async () => {
    mockCharacter({}, {}, "other-user");
    await expect(BuilderLayout({ params: Promise.resolve({ id: "char-1" }), children: null })).rejects.toThrow("notFound");
    expect(getContentRefsByCharacter).not.toHaveBeenCalled();
  });

  it("propagates failed snapshot reads rather than rendering a false Complete status", async () => {
    mockCharacter(selected, scores);
    vi.mocked(getContentRefsByCharacter).mockRejectedValue(new Error("Simulated snapshot read failure"));
    await expect(BuilderOverviewPage({ params: Promise.resolve({ id: "char-1" }) })).rejects.toThrow("Simulated snapshot read failure");
    await expect(BuilderLayout({ params: Promise.resolve({ id: "char-1" }), children: null })).rejects.toThrow("Simulated snapshot read failure");
  });

  it("preserves saved-choice indicators without claiming full readiness validation", () => {
    expect(getBuilderStepStatus("equipment", { starting_equipment: "acknowledged" }, {})).toBe("complete");
    expect(getBuilderStepStatus("abilities", { ability_method: "manual" }, { strength: 10 })).toBe("in_progress");
    expect(getBuilderStepStatus("class", { classes: [{ slug: "fighter", level: 3 }] }, {})).toBe("in_progress");
    expect(getBuilderStepStatus("future-step", selected, scores)).toBe("untouched");
  });
});
