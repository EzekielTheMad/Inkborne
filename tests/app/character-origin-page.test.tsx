import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreationIntent } from "@/lib/character/pending-creation-schema";
const mocks = vi.hoisted(() => ({ client: vi.fn(), submit: vi.fn(), check: vi.fn(), form: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/character/creation-ui-server", () => ({ characterCreationUIEnabled: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error("redirect:" + to); } }));
vi.mock("@/app/(app)/characters/new/origin-actions", () => ({ submitOriginCreation: mocks.submit, checkOriginCreation: mocks.check }));
vi.mock("@/app/(app)/characters/new/origin-form", () => ({ OriginCreationForm: (props: unknown) => { mocks.form(props); return <p>Prepared recovery form</p>; } }));
import NewCharacterPage from "@/app/(app)/characters/new/page";
import { createCharacter } from "@/app/(app)/characters/new/actions";

const account = "10000000-0000-4000-8000-000000000001", system = "10000000-0000-4000-8000-000000000005";
beforeEach(() => vi.clearAllMocks());
describe("flag-on creation entry wiring (no Auth/database proof)", () => {
  it("filters published options to the supported slug and binds the page account into both actions", async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [
        { id: system, name: "D&D 5e", slug: "dnd-5e-2014" },
        { id: account, name: "Other", slug: "other-system" },
      ], error: null }) };
    mocks.client.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: account } } }) }, from: () => query });
    render(await NewCharacterPage({ searchParams: Promise.resolve({ error: "creation_failed" }) }));
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    const props = mocks.form.mock.calls[0][0] as { accountId: string; systems: unknown[];
      submitAction: (intent: CreationIntent) => Promise<unknown>; checkAction: (intent: CreationIntent) => Promise<unknown> };
    expect(props.systems).toEqual([{ id: system, name: "D&D 5e", slug: "dnd-5e-2014" }]);
    expect(props.accountId).toBe(account);
    const intent = { contract_version: 1, operation_id: account, command: "create_character",
      fields: { name: "Elara", system_id: system, campaign_id: null } } as const;
    await props.submitAction(intent); await props.checkAction(intent);
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(account, intent);
    expect(mocks.check).toHaveBeenCalledExactlyOnceWith(account, intent);
    expect(screen.queryByText("Your character could not be created. Please try again.")).not.toBeInTheDocument();
  });
  it("legacy submissions from old tabs cannot fall back while the new path is selected", async () => {
    await expect(createCharacter(new FormData())).rejects.toThrow("redirect:/characters/new?error=creation_failed");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
