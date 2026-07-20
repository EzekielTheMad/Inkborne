import { beforeEach, describe, expect, it, vi } from "vitest";

class TestRedirect extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new TestRedirect(to);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/errors", () => ({
  reportServerError: vi.fn().mockResolvedValue(undefined),
}));

import { revalidatePath } from "next/cache";
import { copyCharacter } from "@/app/(app)/characters/[id]/copy/actions";
import { reportServerError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function mockSupabase(options: {
  user?: { id: string } | null;
  rpcResult?: {
    data: string | null;
    error: { message: string } | null;
  };
} = {}) {
  const user = options.user === undefined ? { id: "user-1" } : options.user;
  const rpcResult = options.rpcResult ?? { data: "char-copy", error: null };
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
  } as never);
  return { rpc };
}

function formData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    source_character_id: "11111111-1111-4111-8111-111111111111",
    name: "Elara (Copy)",
    campaign_id: "",
    ...overrides,
  })) {
    data.set(key, value);
  }
  return data;
}

async function captureRedirect(callback: () => Promise<unknown>) {
  try {
    await callback();
  } catch (error) {
    if (error instanceof TestRedirect) return error.to;
    throw error;
  }
  throw new Error("Expected action to redirect");
}

describe("copyCharacter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated user", async () => {
    mockSupabase({ user: null });
    expect(await captureRedirect(() => copyCharacter(formData()))).toBe("/login");
  });

  it("rejects malformed input before calling the RPC", async () => {
    const { rpc } = mockSupabase();
    const target = await captureRedirect(() =>
      copyCharacter(formData({ name: "   " })),
    );

    expect(target).toContain("?error=invalid_input");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("copies without a campaign when none is selected", async () => {
    const { rpc } = mockSupabase();
    const target = await captureRedirect(() => copyCharacter(formData()));

    expect(rpc).toHaveBeenCalledWith("copy_character", {
      source_character_id: "11111111-1111-4111-8111-111111111111",
      target_campaign_id: null,
      copied_name: "Elara (Copy)",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/characters");
    expect(target).toBe("/characters/char-copy");
  });

  it("passes a selected campaign to the database authorization boundary", async () => {
    const { rpc } = mockSupabase();
    const campaignId = "22222222-2222-4222-8222-222222222222";
    await captureRedirect(() =>
      copyCharacter(formData({ campaign_id: campaignId })),
    );

    expect(rpc).toHaveBeenCalledWith(
      "copy_character",
      expect.objectContaining({ target_campaign_id: campaignId }),
    );
  });

  it("logs a sanitized failure and preserves a retry path", async () => {
    mockSupabase({
      rpcResult: { data: null, error: { message: "permission denied" } },
    });
    const target = await captureRedirect(() => copyCharacter(formData()));

    expect(reportServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        context: expect.objectContaining({ operation: "copy_character" }),
      }),
    );
    expect(target).toContain("?error=copy_failed");
    expect(target).not.toContain("permission");
  });
});
