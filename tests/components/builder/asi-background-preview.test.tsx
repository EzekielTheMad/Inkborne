import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundStepClient } from "@/app/(app)/characters/[id]/builder/background/background-step-client";
import { setCharacterBackground } from "@/lib/supabase/background-selection-client";
import { originalAsiFixture, originalAsiPin, asiId, asiSchema } from "../../fixtures/r06-asi";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/character-client", () => ({ updateCharacter: vi.fn() }));
vi.mock("@/lib/supabase/background-selection-client", () => ({ setCharacterBackground: vi.fn() }));
// Only selection browsing and persistence are simulated; client and StatPreview are actual.
vi.mock("@/components/builder/content-browser", () => ({ ContentBrowser: ({ entries, onSelect }: { entries: unknown[]; onSelect: (entry: unknown) => void }) => <button onClick={() => onSelect(entries[0])}>Select candidate</button> }));
vi.mock("@/components/builder/content-preview", () => ({ ContentPreview: ({ content, onConfirm }: { content: unknown; onConfirm: (entry: unknown) => void }) => content ? <button onClick={() => onConfirm(content)}>Confirm candidate</button> : null }));
afterEach(cleanup); beforeEach(() => vi.clearAllMocks());
function fixture() {
  const f = originalAsiFixture();
  const bg = originalAsiPin("background", "original-watch", { feature: { name: "Original watch", description: "Original synthetic watch." } }, asiId(91), [
    { type: "mechanical", stat: "strength", op: "add", value: 3, condition: { field: "original_boon", op: "eq", value: true } },
  ]);
  f.character.state = { ...f.character.state, original_boon: true };
  f.character.choices.background = bg.slug; f.refs.push(f.ref(bg, asiId(92)));
  const next = originalAsiPin("background", "original-courier", { feature: { name: "Original courier", description: "Original candidate." } }, asiId(93));
  return { f, next };
}
function score() { const preview = screen.getByText("Stats").parentElement!; return within(preview).getByText("STR").parentElement!.children[1].textContent; }
describe("actual Background StatPreview saved-state and unconfirmed selection admission", () => {
  it("review background regression preserves actual saved conditional effect state", () => {
    const { f, next } = fixture();
    render(<BackgroundStepClient characterId={f.character.id} character={f.character} backgrounds={[next]} contentRefs={f.refs} asiEvidence={f.evidence} schema={asiSchema} />);
    expect(score()).toBe("17"); expect(screen.queryByText(/Draft preview only/)).toBeNull();
  });
  it("review background regression pending/rejected choice stays a labelled draft and retains saved values", async () => {
    const { f, next } = fixture(); let reject!: (error: Error) => void;
    vi.mocked(setCharacterBackground).mockReturnValue(new Promise((_resolve, no) => { reject = no; }));
    render(<BackgroundStepClient characterId={f.character.id} character={f.character} backgrounds={[next]} contentRefs={f.refs} asiEvidence={f.evidence} schema={asiSchema} />);
    fireEvent.click(screen.getByRole("button", { name: /Change background/i }));
    fireEvent.click(screen.getByRole("button", { name: "Select candidate" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm candidate" }));
    expect(screen.getByText(/Draft preview only/)).toBeInTheDocument();
    await act(async () => reject(new Error("Simulated rejected selection")));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be selected/);
    expect(score()).toBe("17"); expect(screen.getByText(/Draft preview only/)).toBeInTheDocument();
  });
});
