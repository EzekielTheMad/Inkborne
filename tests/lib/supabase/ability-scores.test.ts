import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { saveCharacterAbilityScores, updateCharacter } from "@/lib/supabase/character-client";

const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => createSupabaseClient("https://local-test.invalid", "local-test-placeholder", {
    global: { fetch: transport.fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }),
}));

const choices = { race: "human", background: "soldier", ability_method: "manual", classes: [{ slug: "fighter", level: 1 }] };
const stats = { strength: 10 };
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("guarded ability-score transport", () => {
  beforeEach(() => { transport.fetch.mockReset(); });

  it("uses the real client to preserve current choices and guard both JSON snapshots", async () => {
    transport.fetch.mockResolvedValueOnce(response({ choices, base_stats: stats }))
      .mockResolvedValueOnce(response({ id: "char-1" }));
    await saveCharacterAbilityScores("char-1", "point_buy", { strength: 8 });
    const [address, options] = transport.fetch.mock.calls[1];
    const url = new URL(address);
    expect(options.method).toBe("PATCH");
    expect(url.searchParams.get("id")).toBe("eq.char-1");
    expect(url.searchParams.get("choices")).toBe(`eq.${JSON.stringify(choices)}`);
    expect(url.searchParams.get("base_stats")).toBe(`eq.${JSON.stringify(stats)}`);
    expect(url.searchParams.get("select")).toBe("id");
    expect(JSON.parse(options.body)).toEqual({
      base_stats: { strength: 8 }, choices: { ...choices, ability_method: "point_buy" },
    });
    expect(options.headers.get("Prefer")).toContain("return=representation");
  });

  it.each([
    { code: "PGRST116", message: "No rows after a concurrent change", details: "0 rows" },
    { code: "42501", message: "RLS denied", details: "private" },
  ])("does not report success for a guarded/denied update ($code)", async (error) => {
    transport.fetch.mockResolvedValueOnce(response({ choices, base_stats: stats }))
      .mockResolvedValueOnce(response(error, 406));
    await expect(saveCharacterAbilityScores("char-1", "manual", { strength: 18 })).rejects.toThrow("could not be saved");
  });

  it("does not write after a failed read", async () => {
    transport.fetch.mockResolvedValueOnce(response({ code: "PGRST116", message: "not found" }, 406));
    await expect(saveCharacterAbilityScores("char-1", "manual", { strength: 18 })).rejects.toThrow("could not be loaded");
    expect(transport.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not treat a missing returned row as confirmation", async () => {
    transport.fetch.mockResolvedValueOnce(response({ choices, base_stats: stats }))
      .mockResolvedValueOnce(response(null));
    await expect(saveCharacterAbilityScores("char-1", "manual", { strength: 18 })).rejects.toThrow("could not be saved");
  });
  it("rejects an already closed editor without requesting data", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(saveCharacterAbilityScores("char-1", "manual", { strength: 18 }, controller.signal)).rejects.toThrow("session has closed");
    expect(transport.fetch).not.toHaveBeenCalled();
  });

  it("does not send a patch when the editor closes during its read", async () => {
    const controller = new AbortController();
    transport.fetch.mockImplementationOnce(async () => {
      controller.abort(); return response({ choices, base_stats: stats });
    });
    await expect(saveCharacterAbilityScores("char-1", "manual", { strength: 18 }, controller.signal)).rejects.toThrow("session has closed");
    expect(transport.fetch).toHaveBeenCalledTimes(1);
    expect(transport.fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("requires a returned row for general builder updates too", async () => {
    transport.fetch.mockResolvedValueOnce(response({ id: "char-1" }));
    await updateCharacter("char-1", { choices: { race: "human" } });
    const [address, options] = transport.fetch.mock.calls[0];
    expect(new URL(address).searchParams.get("select")).toBe("id");
    expect(options.headers.get("Prefer")).toContain("return=representation");
    transport.fetch.mockResolvedValueOnce(response(null));
    await expect(updateCharacter("char-1", { choices: { race: "elf" } })).rejects.toThrow("could not be confirmed");
  });

});
