import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NpcProfile } from "@/components/compendium/npc-profile";
import { CompendiumDetail } from "@/components/compendium/compendium-detail";
import { CompendiumBrowser } from "@/components/compendium/compendium-browser";
import { parseCompendiumQuery, isCompendiumCategory } from "@/lib/compendium/catalog";
import { getCompendiumEntryDescription, getCompendiumEntryFacts } from "@/lib/compendium/presentation";
import { npcEnvelope, npcOwnerId, npcSystemId, originalNpc } from "@/tests/fixtures/npcs";

describe("actual read-only NPC Library/profile", () => {
  it("renders ordered personality and relationship ideas as text with no resolved links", () => {
    render(<NpcProfile data={originalNpc} />);
    const list = within(screen.getByRole("region", { name: "Personality traits" })).getAllByRole("listitem");
    expect(list.map(item => item.textContent)).toEqual(originalNpc.personality!.personality_traits);
    expect(screen.getByRole("region", { name: "Template relationship ideas" })).toHaveTextContent("The bell maker");
    expect(screen.getByText(/do not create or link character relationships/)).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
  });
  it("uses existing detail dispatch, occupation/provenance and escaped description", () => {
    const description = '<script>window.compromised=true</script><img src=x onerror="alert(1)">';
    const row = npcEnvelope({ ...originalNpc, description });
    render(<CompendiumDetail entry={row} userId={npcOwnerId} returnHref="/library?category=npcs" />);
    expect(screen.getByRole("heading", { name: row.name })).toBeVisible();
    expect(screen.getByText(description)).toBeVisible(); expect(document.querySelector("script,img")).toBeNull();
    expect(screen.getByText("Bridge keeper")).toBeVisible(); expect(screen.getByText("Your homebrew")).toBeVisible();
    expect(screen.getByText("This NPC narrative template is read-only.")).toBeVisible();
    expect(screen.queryByText(/Manage content you own/)).toBeNull();
    expect(getCompendiumEntryFacts(row)).toEqual([{ label: "Occupation", value: "Bridge keeper" }]);
  });
  it("does not invent absent profile sections, description or game stats", () => {
    const row = npcEnvelope({ schema_version: 1 });
    render(<CompendiumDetail entry={row} userId={npcOwnerId} returnHref="/library" />);
    expect(screen.queryByRole("heading", { name: "Description" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Template relationship ideas" })).toBeNull();
    expect(screen.queryByText("Armor Class")).toBeNull();
    expect(getCompendiumEntryDescription(row)).toBe("NPC narrative template.");
  });
  it("exposes category/search/filter/return semantics through the actual Library browser", () => {
    const query = parseCompendiumQuery({ category: "npcs", system: npcSystemId });
    render(<CompendiumBrowser systems={[{ id: npcSystemId, name: "Original fixture", slug: "fixture", versionLabel: "2014" }]}
      query={query} result={{ entries: [npcEnvelope()], total: 1, page: 1, pageSize: 24 }} userId={npcOwnerId} />);
    expect(isCompendiumCategory("npcs")).toBe(true);
    expect(screen.getByRole("link", { name: "NPCs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Search by name")).toHaveAttribute("placeholder", "Search npcs…");
    expect(screen.queryByLabelText("Size")).toBeNull();
    expect(screen.getByRole("link", { name: /Original Bridge Keeper/ })).toHaveAttribute("href", expect.stringContaining("returnTo="));
  });
});
