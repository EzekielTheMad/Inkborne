import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser supabase client BEFORE importing the helper.
const mockEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));
const mockClient = { from: mockFrom };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { updateCharacterColor } from "@/lib/supabase/character-client";

describe("updateCharacterColor", () => {
  beforeEach(() => {
    mockEq.mockReset();
    mockUpdate.mockClear();
    mockFrom.mockClear();
  });

  it("writes the hex to the characters row", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacterColor("char-123", "#7c3aed");
    expect(mockFrom).toHaveBeenCalledWith("characters");
    expect(mockUpdate).toHaveBeenCalledWith({ primary_color: "#7c3aed" });
    expect(mockEq).toHaveBeenCalledWith("id", "char-123");
  });

  it("writes null to clear the color", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacterColor("char-123", null);
    expect(mockUpdate).toHaveBeenCalledWith({ primary_color: null });
  });

  it("throws when the supabase write errors", async () => {
    mockEq.mockResolvedValue({ error: { message: "RLS violation" } });
    await expect(updateCharacterColor("char-123", "#7c3aed")).rejects.toThrow("RLS violation");
  });
});
