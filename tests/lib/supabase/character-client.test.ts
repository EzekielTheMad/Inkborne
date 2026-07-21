import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser supabase client BEFORE importing the helper.
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));
const mockClient = { from: mockFrom };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  updateCharacter,
  updateCharacterAndReturn,
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

describe("updateCharacterAndReturn", () => {
  beforeEach(() => {
    mockEq.mockReset();
    mockSelect.mockClear();
    mockSingle.mockReset();
    mockUpdate.mockClear();
    mockFrom.mockClear();
  });

  it("returns the canonical choices after database triggers run", async () => {
    mockEq.mockReturnValue({ select: mockSelect });
    mockSingle.mockResolvedValue({
      data: {
        choices: { classes: [{ slug: "fighter", level: 3 }] },
        level: 3,
      },
      error: null,
    });

    await expect(updateCharacterAndReturn("char-1", {
      choices: {
        classes: [{ slug: "fighter", level: 3 }],
        asi_choices: {
          "fighter-asi-4": {
            mode: "feat",
            featId: "feat-id",
            featVersion: 1,
            featName: "Sentinel",
          },
        },
      },
      level: 3,
    })).resolves.toEqual({
      choices: { classes: [{ slug: "fighter", level: 3 }] },
      level: 3,
    });
    expect(mockSelect).toHaveBeenCalledWith("choices, level");
  });

  it("throws when the canonical row cannot be returned", async () => {
    mockEq.mockReturnValue({ select: mockSelect });
    mockSingle.mockResolvedValue({ data: null, error: { message: "RLS denied" } });

    await expect(updateCharacterAndReturn("char-1", { level: 3 }))
      .rejects.toThrow("RLS denied");
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
