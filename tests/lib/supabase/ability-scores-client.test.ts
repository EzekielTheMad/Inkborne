import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbilityScoreConflictError, saveCharacterAbilities } from "@/lib/supabase/ability-scores-client";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
const next = { method: "manual" as const, scores: { str: 16 } };
const expected = { method: null, scores: {} };

beforeEach(() => { rpc.mockReset(); });

describe("saveCharacterAbilities", () => {
  it("sends only the target, new ability values, and raw expectations", async () => {
    rpc.mockResolvedValue({ data: [{ saved_method: "manual", saved_scores: { str: 16 } }], error: null });
    await expect(saveCharacterAbilities("char-1", next, expected)).resolves.toEqual(next);
    expect(rpc).toHaveBeenCalledWith("save_character_abilities", {
      target_character_id: "char-1", ability_method: "manual", ability_scores: { str: 16 },
      expected_method: null, expected_scores: {},
    });
  });

  it("distinguishes a nonretryable stale-editor conflict", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "ABILITY_SCORES_CHANGED" } });
    await expect(saveCharacterAbilities("char-1", next, expected)).rejects.toBeInstanceOf(AbilityScoreConflictError);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("preserves ordinary errors without interpreting them as conflicts", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Character not available." } });
    await expect(saveCharacterAbilities("char-1", next, expected)).rejects.toThrow("Character not available.");
  });

  it.each([null, [], [{ saved_method: "manual", saved_scores: { str: "16" } }]])("fails closed for invalid returned data: %j", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(saveCharacterAbilities("char-1", next, expected)).rejects.toThrow("response was invalid");
  });
});
