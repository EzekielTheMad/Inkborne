import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/lib/builder/use-is-mobile";

describe("useIsMobile", () => {
  let mockMql: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
  let changeListener: ((e: { matches: boolean }) => void) | null = null;

  beforeEach(() => {
    mockMql = {
      matches: false,
      addEventListener: vi.fn((event: string, listener: (e: { matches: boolean }) => void) => {
        if (event === "change") changeListener = listener;
      }),
      removeEventListener: vi.fn(() => {
        changeListener = null;
      }),
    };
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue(mockMql),
    });
  });

  afterEach(() => {
    changeListener = null;
  });

  it("returns false when viewport is desktop (matchMedia matches=false)", () => {
    mockMql.matches = false;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when viewport is mobile (matchMedia matches=true)", () => {
    mockMql.matches = true;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("subscribes to matchMedia change events", () => {
    renderHook(() => useIsMobile());
    expect(mockMql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("updates when matchMedia change fires", () => {
    mockMql.matches = false;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      changeListener?.({ matches: true });
    });
    expect(result.current).toBe(true);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mockMql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("queries the (max-width: 767px) media query", () => {
    renderHook(() => useIsMobile());
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });
});
