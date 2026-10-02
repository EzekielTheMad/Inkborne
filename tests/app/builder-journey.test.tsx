import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import BuilderLayout from "@/app/(app)/characters/[id]/builder/layout";
import BuilderOverviewPage from "@/app/(app)/characters/[id]/builder/page";
import { createClient } from "@/lib/supabase/server";
import { getBuilderStepStatus } from "@/lib/builder/step-status";
import type { CharacterChoices } from "@/lib/types/character";

const navigation = vi.hoisted(() => ({ pathname: "/characters/char-1/builder" }));
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
const scores = { strength: 15, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 };

describe("local builder journey", () => {
  beforeEach(() => { vi.clearAllMocks(); navigation.pathname = "/characters/char-1/builder"; });

  it.each([
    { name: "fresh character", choices: {}, stats: {}, labels: ["Not started", "Not started", "Not started", "Not started", "Not started"] },
    { name: "ability method selected", choices: { ability_method: "standard_array" }, stats: {}, labels: ["Not started", "Not started", "Not started", "In progress", "Not started"] },
    { name: "saved core choices", choices: selected, stats: scores, labels: ["Complete", "Complete", "Complete", "Complete", "Not started"] },
    { name: "partial abilities", choices: selected, stats: { strength: 15 }, labels: ["Complete", "Complete", "Complete", "In progress", "Not started"] },
    { name: "equipment draft", choices: { ...selected, starting_equipment: { selections: {}, picks: {} } }, stats: scores, labels: ["Complete", "Complete", "Complete", "Complete", "In progress"] },
    { name: "equipment confirmed", choices: { ...selected, starting_equipment: { selections: {}, picks: {}, confirmed: true } }, stats: scores, labels: ["Complete", "Complete", "Complete", "Complete", "Complete"] },
  ])("keeps overview and navigation aligned for $name", async ({ choices, stats, labels }) => {
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
  });

  it("rejects another user's character at the layout boundary", async () => {
    mockCharacter({}, {}, "other-user");
    await expect(BuilderLayout({ params: Promise.resolve({ id: "char-1" }), children: null })).rejects.toThrow("notFound");
  });

  it("preserves saved-choice indicators without claiming full readiness validation", () => {
    expect(getBuilderStepStatus("equipment", { starting_equipment: "acknowledged" }, {})).toBe("complete");
    expect(getBuilderStepStatus("abilities", { ability_method: "manual" }, { strength: 10 })).toBe("in_progress");
    expect(getBuilderStepStatus("class", { classes: [{ slug: "fighter", level: 3 }] }, {})).toBe("complete");
    expect(getBuilderStepStatus("future-step", selected, scores)).toBe("untouched");
  });
});
