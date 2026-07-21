import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConflictItem: vi.fn(),
  getUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/mpmb-imports-server", () => ({
  getOwnedMpmbImportConflictItem: mocks.getConflictItem,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/components/library/mpmb-import-conflict-resolution-form", () => ({
  MpmbImportConflictResolutionForm: ({ candidateName }: { candidateName: string }) => (
    <div data-testid="resolution-form">Resolve {candidateName}</div>
  ),
}));

import MpmbImportConflictPage from "@/app/(app)/library/import/[id]/items/[itemId]/conflict/page";

const IMPORT_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  mocks.getConflictItem.mockResolvedValue({
    importId: IMPORT_ID,
    itemId: ITEM_ID,
    revision: 4,
    candidateName: "Ember Ward",
    contentType: "spell",
    conflictResolution: null,
    replacementContentId: null,
    replacementExpectedVersion: null,
    conflicts: [{
      id: "55555555-5555-4555-8555-555555555555",
      name: "Ember Ward",
      version: 2,
      scope: "personal",
      sharedCampaignCount: 0,
      previouslyImported: false,
      replaceable: true,
    }],
  });
});

describe("MpmbImportConflictPage", () => {
  it("explains the safe resolution boundary and renders the owner-only form", async () => {
    render(await MpmbImportConflictPage({
      params: Promise.resolve({ id: IMPORT_ID, itemId: ITEM_ID }),
    }));

    expect(screen.getByRole("heading", { name: "Choose what to keep" })).toBeVisible();
    expect(screen.getByText(/No automatic merge/)).toBeVisible();
    expect(screen.getByText(/rechecks ownership, the target version, sharing state/i)).toBeVisible();
    expect(screen.getByTestId("resolution-form")).toHaveTextContent("Ember Ward");
    expect(screen.getByRole("link", { name: "Back to import review" })).toHaveAttribute(
      "href",
      `/library/import/${IMPORT_ID}`,
    );
  });

  it("redirects unauthenticated visitors before looking up an import item", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(MpmbImportConflictPage({
      params: Promise.resolve({ id: IMPORT_ID, itemId: ITEM_ID }),
    })).rejects.toThrow("REDIRECT:/login");

    expect(mocks.getConflictItem).not.toHaveBeenCalled();
  });

  it("does not reveal another user's item", async () => {
    mocks.getConflictItem.mockResolvedValue(null);

    await expect(MpmbImportConflictPage({
      params: Promise.resolve({ id: IMPORT_ID, itemId: ITEM_ID }),
    })).rejects.toThrow("NOT_FOUND");
  });
});
