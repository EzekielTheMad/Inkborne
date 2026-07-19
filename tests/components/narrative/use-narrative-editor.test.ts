import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

import {
  saveNarrative,
  saveNarrativeRich,
  savePersonalityChoices,
} from "@/app/(app)/characters/[id]/narrative-actions";

const saveNarrativeMock = vi.mocked(saveNarrative);
const saveNarrativeRichMock = vi.mocked(saveNarrativeRich);
const savePersonalityChoicesMock = vi.mocked(savePersonalityChoices);

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
    vi.clearAllMocks();
    vi.useFakeTimers();
    saveNarrativeMock.mockResolvedValue({ success: true });
    saveNarrativeRichMock.mockResolvedValue({ success: true });
    savePersonalityChoicesMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("keeps failed autosaves dirty so they can be retried", async () => {
    saveNarrativeMock.mockResolvedValueOnce({ error: "network down" });
    const { result } = renderHook(() =>
      useNarrativeEditor({ character: makeChar() }),
    );

    act(() => result.current.enterEdit());
    act(() => result.current.handleNarrativeChange("full_name", "Retry Me"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.saveStatus).toBe("error");
    expect(saveNarrativeMock).toHaveBeenCalledTimes(1);

    act(() => result.current.scheduleAutoSave());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(saveNarrativeMock).toHaveBeenCalledTimes(2);
    expect(result.current.saveStatus).toBe("saved");
    expect(result.current.savedNarrative.full_name).toBe("Retry Me");
  });

  it("keeps the editor open when manual save fails", async () => {
    saveNarrativeMock.mockResolvedValueOnce({ error: "permission denied" });
    const { result } = renderHook(() =>
      useNarrativeEditor({ character: makeChar() }),
    );

    act(() => result.current.enterEdit());
    act(() => result.current.handleNarrativeChange("full_name", "Unsaved Name"));
    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(result.current.editMode).toBe(true);
    expect(result.current.saveStatus).toBe("error");
    expect(result.current.savedNarrative.full_name).toBe("Saved Name");

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(result.current.editMode).toBe(false);
    expect(result.current.saveStatus).toBe("saved");
    expect(result.current.savedNarrative.full_name).toBe("Unsaved Name");
  });
});
