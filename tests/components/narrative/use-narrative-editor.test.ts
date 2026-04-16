import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNarrativeEditor } from "@/components/narrative/use-narrative-editor";
import type { CharacterWithSystem } from "@/lib/types/character";

vi.mock("@/app/(app)/characters/[id]/narrative-actions", () => ({
  saveNarrative: vi.fn().mockResolvedValue({ success: true }),
  saveNarrativeRich: vi.fn().mockResolvedValue({ success: true }),
  savePersonalityChoices: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

function makeChar(): CharacterWithSystem {
  return {
    id: "char-1",
    name: "Test",
    narrative: { full_name: "Saved Name" },
    narrative_rich: {},
    choices: {},
  } as unknown as CharacterWithSystem;
}

describe("useNarrativeEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("starts in view mode", () => {
    const { result } = renderHook(() => useNarrativeEditor({ character: makeChar() }));
    expect(result.current.editMode).toBe(false);
  });

  it("enters edit mode and copies saved values to local", () => {
    const { result } = renderHook(() => useNarrativeEditor({ character: makeChar() }));
    act(() => result.current.enterEdit());
    expect(result.current.editMode).toBe(true);
    expect(result.current.localNarrative.full_name).toBe("Saved Name");
  });

  it("handleNarrativeChange marks dirty and schedules save", async () => {
    const { saveNarrative } = await import(
      "@/app/(app)/characters/[id]/narrative-actions"
    );
    const { result } = renderHook(() =>
      useNarrativeEditor({ character: makeChar() }),
    );
    act(() => result.current.enterEdit());
    act(() => result.current.handleNarrativeChange("full_name", "New"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(saveNarrative).toHaveBeenCalledWith(
      "char-1",
      expect.objectContaining({ full_name: "New" }),
    );
  });

  it("handleCancel reverts local to saved and exits edit mode", () => {
    const { result } = renderHook(() =>
      useNarrativeEditor({ character: makeChar() }),
    );
    act(() => result.current.enterEdit());
    act(() => result.current.handleNarrativeChange("full_name", "Draft"));
    act(() => result.current.handleCancel());
    expect(result.current.editMode).toBe(false);
    expect(result.current.localNarrative.full_name).toBe("Saved Name");
  });
});
