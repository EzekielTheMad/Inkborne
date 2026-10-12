import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { printFixture } from "../../../e2e/print/fixtures";
import { CharacterPageClient } from "@/components/character/character-page-client";

// Keep the real page client and provider; isolate the shell to the action under
// test so unrelated editors do not invoke persistence.
vi.mock("@/components/character/character-shell", async () => {
  const { CharacterPrintAction } = await import("@/components/sheet/character-print-action");
  return { CharacterShell: CharacterPrintAction };
});

function renderPage(contentSnapshotsComplete: boolean | undefined) {
  const ctx = printFixture("martial");
  return render(<CharacterPageClient character={ctx.character} schema={ctx.schema} evalResult={ctx.evalResult} contentRefs={ctx.contentRefs}
    contentSnapshotsComplete={contentSnapshotsComplete} initialState={ctx.state} maxHp={ctx.maxHp} allEffects={[]}
    baseStatsWithLevel={{ ...ctx.evalResult.stats, level: 5 }} structuredSources={{ level: 5 }}
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
