import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser supabase client BEFORE importing the helper.
const mockEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));
const mockClient = { from: mockFrom };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  updateCharacter,
  updateCharacterColor,
} from "@/lib/supabase/character-client";

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

describe("updateCharacter", () => {
  beforeEach(() => {
    mockEq.mockReset();
    mockUpdate.mockClear();
    mockFrom.mockClear();
  });

  it("writes a partial patch to the characters row", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacter("char-1", { level: 5 });
    expect(mockFrom).toHaveBeenCalledWith("characters");
    expect(mockUpdate).toHaveBeenCalledWith({ level: 5 });
    expect(mockEq).toHaveBeenCalledWith("id", "char-1");
  });

  it("writes multi-field patches in a single update", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacter("char-1", {
      choices: { classes: [{ slug: "wizard", level: 3 }] },
      level: 3,
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      choices: { classes: [{ slug: "wizard", level: 3 }] },
      level: 3,
    });
  });

  it("throws when supabase returns an error", async () => {
    mockEq.mockResolvedValue({ error: { message: "RLS denied" } });
    await expect(
      updateCharacter("char-1", { level: 5 }),
    ).rejects.toThrow("RLS denied");
  });

  it("is a no-op for an empty patch (defensive)", async () => {
    await updateCharacter("char-1", {});
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("updateCharacterColor (post-refactor delegation)", () => {
  beforeEach(() => {
    mockEq.mockReset();
    mockUpdate.mockClear();
    mockFrom.mockClear();
  });

  it("delegates to updateCharacter with { primary_color }", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacterColor("char-1", "#7c3aed");
    expect(mockFrom).toHaveBeenCalledWith("characters");
    expect(mockUpdate).toHaveBeenCalledWith({ primary_color: "#7c3aed" });
    expect(mockEq).toHaveBeenCalledWith("id", "char-1");
  });
});
