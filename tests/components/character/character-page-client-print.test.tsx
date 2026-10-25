import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { printFixture } from "../../../e2e/print/fixtures";
import { CharacterPageClient } from "@/components/character/character-page-client";
import { pinnedSlotClass } from "../../fixtures/pinned-slot-class";
import { providerSources, providerRaceRef, providerSystemId } from "../../fixtures/provider-mechanics";

// Keep the real page client and provider; isolate the shell to the action under
// test so unrelated editors do not invoke persistence.
vi.mock("@/components/character/character-shell", async () => {
  const { CharacterPrintAction } = await import("@/components/sheet/character-print-action");
  return { CharacterShell: CharacterPrintAction };
});

function renderPage(contentSnapshotsComplete: boolean | undefined) {
  const ctx = printFixture("martial");
  ctx.character.system_id = providerSystemId;
  ctx.character.game_systems.id = providerSystemId;
  ctx.contentRefs = ctx.contentRefs.map(ref => ({ ...ref, content_definitions: { ...ref.content_definitions, system_id: providerSystemId } }));
  ctx.inventory = ctx.inventory.map(row => ({ ...row, ...(row.content_definitions
    ? { content_definitions: { ...row.content_definitions, system_id: providerSystemId } } : {}) }));
  ctx.contentRefs.push(providerRaceRef("human", ctx.character.id, providerSystemId));
  ctx.contentRefs.push(pinnedSlotClass("fighter", 5, null, null, ctx.character.id, ctx.character.system_id));
  // This page-client boundary must use actual evaluated declared math, rather
  // than the renderer fixture's preloaded output snapshot.
  ctx.schema.derived_stats = [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 3 }, { slug: "initiative", name: "Initiative", base: 1 }];
  const sources = providerSources(ctx.character, ctx.contentRefs);
  expect(sources.ancestryDefenses).toEqual({ status: "available", dmgres: [] });
  return render(<CharacterPageClient character={ctx.character} schema={ctx.schema} evalResult={ctx.evalResult} contentRefs={ctx.contentRefs}
    contentSnapshotsComplete={contentSnapshotsComplete} initialState={ctx.state} maxHp={ctx.maxHp} allEffects={[]}
    baseStatsWithLevel={{ ...ctx.character.base_stats, level: 5 }} structuredSources={sources}
    isOwner isDm={false} hasSheet initialInventory={ctx.inventory} initialSpells={ctx.spells}
    classData={{ fighter: { slug: "fighter", data: { hit_die: 10 } } }} campaignPageBacklinks={[]} timelineEvents={[]} relationships={[]} />);
}

describe("server completeness metadata through page client and real provider", () => {
  it.each([undefined, false])("defaults incomplete evidence to disabled printing (%s)", value => {
    renderPage(value);
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
  });
  it("allows a fully readable snapshot and exports current evaluated sheet data", () => {
    renderPage(true);
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    const preview = screen.getByRole("dialog", { name: "Print preview" });
    expect(preview).toHaveTextContent("Mara Stonepath");
    expect(preview).toHaveTextContent("23/38 (4 temporary)");
    expect(preview).toHaveTextContent("Roadwarden Blade v3");
    expect(preview.textContent).not.toContain("FORBIDDEN_");
    fireEvent.click(within(preview).getByRole("button", { name: "Back to character" }));
  });
});
