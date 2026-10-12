import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/homebrew-races-server", () => ({
  createHomebrewRaceRecord: mocks.create,
  updateHomebrewRaceRecord: mocks.update,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));

import {
  createHomebrewRace,
  updateHomebrewRace,
} from "@/app/(app)/homebrew/races/actions";

const idle = { status: "idle" as const, message: "" };

describe("homebrew race actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  });

  it("redirects unauthenticated mutations before touching content", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(createHomebrewRace(idle, new FormData())).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns recoverable validation failures", async () => {
    const failure = { status: "error" as const, message: "Check the fields." };
    mocks.create.mockResolvedValue(failure);

    await expect(createHomebrewRace(idle, new FormData())).resolves.toEqual(failure);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("revalidates Homebrew and Library after creation", async () => {
    mocks.create.mockResolvedValue({ id: "race-id" });

    await expect(createHomebrewRace(idle, new FormData())).rejects.toThrow(
      "REDIRECT:/homebrew?created=race-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
  });

  it("rejects malformed edit identity before the persistence helper", async () => {
    await expect(updateHomebrewRace(idle, new FormData())).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns stale conflicts without redirecting", async () => {
    const input = new FormData();
    input.set("id", "race-id");
    input.set("expected_version", "1");
    const conflict = { status: "conflict" as const, message: "Reload the latest version." };
    mocks.update.mockResolvedValue(conflict);

    await expect(updateHomebrewRace(idle, input)).resolves.toEqual(conflict);
    expect(mocks.update).toHaveBeenCalledWith("race-id", 1, input);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates both catalogs and the edit route after update", async () => {
    const input = new FormData();
    input.set("id", "race-id");
    input.set("expected_version", "1");
    mocks.update.mockResolvedValue({ id: "race-id" });

    await expect(updateHomebrewRace(idle, input)).rejects.toThrow(
      "REDIRECT:/homebrew?updated=race-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/homebrew/races/race-id/edit",
    );
  });
});
