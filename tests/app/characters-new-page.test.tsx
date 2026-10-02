import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NewCharacterPage from "@/app/(app)/characters/new/page";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/app/(app)/characters/new/actions", () => ({ createCharacter: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

function mockSystems(data: Array<{ id: string; name: string; slug: string }>, error: object | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: vi.fn().mockReturnValue(query),
  } as never);
  return query;
}

describe("new character entry", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("offers refresh after a rejected game-system request", async () => {
    const query = mockSystems([]);
    query.order.mockRejectedValueOnce(new Error("network interrupted"));
    render(await NewCharacterPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Refresh the page and try again.");
    expect(screen.getByRole("button", { name: /begin/i })).toBeDisabled();
  });

  it("opens the single-system path without asking for an unnecessary choice", async () => {
    mockSystems([{ id: "dnd", name: "D&D 5e", slug: "dnd-5e-2014" }]);
    const { container } = render(await NewCharacterPage({ searchParams: Promise.resolve({}) }));
    expect(container.querySelector('input[name="system_id"]')).toHaveValue("dnd");
    expect(screen.getByRole("button", { name: /begin/i })).toBeEnabled();
  });

  it.each(["creation_failed", "bad%escape", "database internal details"])("renders safe recovery copy for %s", async (error) => {
    mockSystems([{ id: "dnd", name: "D&D 5e", slug: "dnd-5e-2014" }]);
    render(await NewCharacterPage({ searchParams: Promise.resolve({ error }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Your character could not be created. Please try again.");
    expect(screen.getByRole("alert")).not.toHaveTextContent(error);
  });

  it("explains required fields instead of displaying an internal error code", async () => {
    mockSystems([{ id: "dnd", name: "D&D 5e", slug: "dnd-5e-2014" }]);
    render(await NewCharacterPage({ searchParams: Promise.resolve({ error: "missing_fields" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a character name and choose a game system.");
  });

  it.each([null, { message: "network" }])("prevents starting without an available game system (%j)", async (error) => {
    mockSystems([], error);
    render(await NewCharacterPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent(error ? "Refresh the page" : "No game systems are available");
    expect(screen.getByRole("button", { name: /begin/i })).toBeDisabled();
  });
});
