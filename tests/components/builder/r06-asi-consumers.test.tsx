import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { ClassStepClient } from "@/app/(app)/characters/[id]/builder/class/class-step-client";
import { RaceStepClient } from "@/app/(app)/characters/[id]/builder/race/race-step-client";
import { StatPreview } from "@/components/builder/stat-preview";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { originalAsiFixture, originalAsiPin, asiId, asiSchema } from "../../fixtures/r06-asi";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/character-client", () => ({ updateCharacter: vi.fn(), updateCharacterAndReturn: vi.fn() }));
vi.mock("@/lib/supabase/content-refs-client", () => ({ insertContentRef: vi.fn(), removeContentRefById: vi.fn() }));
vi.mock("@/app/(app)/characters/[id]/builder/class/actions", () => ({ reconcileClassFeatureRefsAction: vi.fn(), searchUsableFeatsAction: vi.fn(), setCharacterAsiChoiceAction: vi.fn() }));
vi.mock("@/lib/builder/use-ability-score-draft", () => ({ discardAbilityScoreDraft: vi.fn(), useAbilityScoreDraft: (_owner: string, _id: string, draft: unknown) => ({ draft, status: "saved", changeDraft: vi.fn(), retry: vi.fn() }) }));
afterEach(cleanup);
function previewScore() { const preview = screen.getByText("Stats").parentElement!; return within(preview).getByText("STR").parentElement!.children[1].textContent; }
describe("actual earned ASI consumers, simulated persistence only", () => {
  it("Abilities total/sidebar includes earned +2 once; nominal attribution is not a second bonus", () => {
    const f = originalAsiFixture();
    render(<AbilitiesStepClient ownerId={f.character.user_id} characterId={f.character.id} character={f.character} contentRefs={f.refs} asiEvidence={f.evidence} schema={asiSchema} />);
    const card = screen.getByRole("spinbutton", { name: "Strength score" }).closest('[data-slot="card"]')! as HTMLElement;
    expect(within(card).getByText("Total").nextElementSibling).toHaveTextContent("14");
    expect(previewScore()).toBe("14"); expect(screen.getByText(/nominal allocation/)).toBeInTheDocument();
  });
  it("actual Class rail crosses STR13 with shared earned14, while incomplete evidence makes prerequisites unavailable", () => {
    const f = originalAsiFixture();
    const barbarian = originalAsiPin("class", "barbarian", f.cls.data, asiId(90));
    const props = { characterId: f.character.id, character: f.character, classes: [f.cls, barbarian], subclasses: [], features: [f.feature], feats: [], spells: [], contentRefs: f.refs, schema: asiSchema };
    const view = render(<ClassStepClient {...props} asiEvidence={f.evidence} />);
    expect(screen.getByText(/STR 13 · met/)).toBeInTheDocument(); expect(previewScore()).toBe("14");
    view.rerender(<ClassStepClient {...props} asiEvidence={{ status: "unavailable", reason: "incomplete_evidence" }} />);
    expect(screen.getByText(/Saved ability mechanics unavailable/)).toBeInTheDocument();
  });
  it("actual Race and direct StatPreview consume the same immutable contribution", () => {
    const f = originalAsiFixture();
    const view = render(<RaceStepClient characterId={f.character.id} character={f.character} races={[f.race]} subraces={[]} traits={[]} contentRefs={f.refs} asiEvidence={f.evidence} schema={asiSchema} />);
    expect(previewScore()).toBe("14");
    view.unmount();
    render(<StatPreview baseStats={f.character.base_stats} effects={f.refs.flatMap(ref => ref.content_definitions.effects)} schema={asiSchema} level={4}
      sources={buildCharacterStructuredSources(f.refs, 4, { character: f.character, evidence: f.evidence })} />);
    expect(previewScore()).toBe("14");
  });
  it("saved-shape-only input remains visibly unverified and cannot become an earned bonus", () => {
    const f = originalAsiFixture();
    render(<AbilitiesStepClient ownerId={f.character.user_id} characterId={f.character.id} character={f.character} contentRefs={f.refs} schema={asiSchema} />);
    expect(previewScore()).toBe("12"); expect(screen.getByText(/Saved choice amounts are unverified evidence/)).toBeInTheDocument();
  });
});
