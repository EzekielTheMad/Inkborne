import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRepairItem: vi.fn(),
  getUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/mpmb-imports-server", () => ({
  getOwnedMpmbImportRepairItem: mocks.getRepairItem,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/components/library/mpmb-import-spell-repair-form", () => ({
  MpmbImportSpellRepairForm: ({
    candidateName,
  }: {
    candidateName: string;
  }) => <div>Repair form for {candidateName}</div>,
}));
vi.mock("@/components/library/mpmb-import-feat-repair-form", () => ({
  MpmbImportFeatRepairForm: ({
    candidateName,
  }: {
    candidateName: string;
  }) => <div>Feat repair form for {candidateName}</div>,
}));

import MpmbImportSpellRepairPage from "@/app/(app)/library/import/[id]/items/[itemId]/edit/page";

const IMPORT_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";

const repairItem = {
  contentType: "spell" as const,
  importId: IMPORT_ID,
  itemId: ITEM_ID,
  revision: 3,
  candidateName: "Ash Veil",
  data: {
    level: 1,
    school: "abjuration" as const,
    casting_time: "1 action",
    range: "Self",
    components: ["V", "S", "M"] as Array<"V" | "S" | "M">,
    duration: "1 minute",
    concentration: false,
    ritual: false,
    description: "A synthetic test spell.",
    damage: null,
    heal_at_slot_level: null,
    dc: null,
    area_of_effect: null,
    classes: [],
    subclasses: [],
    dependencies: [],
  },
  repairFields: {
    material: true,
    dc: false,
    concentration: false,
    ritual: false,
  },
  otherBlockingIssues: 1,
  userEditedFields: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    error: null,
  });
  mocks.getRepairItem.mockResolvedValue(repairItem);
});

describe("MpmbImportSpellRepairPage", () => {
  it("shows an owned repairable spell and warns about remaining blockers", async () => {
    render(await MpmbImportSpellRepairPage({
      params: Promise.resolve({ id: IMPORT_ID, itemId: ITEM_ID }),
    }));

    expect(screen.getByRole("heading", { name: "Add missing details" })).toBeVisible();
    expect(screen.getByText("Repair form for Ash Veil")).toBeVisible();
    expect(screen.getByText(/1 additional blocking issue/i)).toBeVisible();
    expect(screen.getByText(/original JavaScript is not stored/i)).toBeVisible();
  });

  it("does not reveal a missing or non-repairable item", async () => {
    mocks.getRepairItem.mockResolvedValue(null);
    await expect(MpmbImportSpellRepairPage({
      params: Promise.resolve({ id: IMPORT_ID, itemId: ITEM_ID }),
    })).rejects.toThrow("NOT_FOUND");
  });

  it("renders the finite feat repair form for a feat DTO", async () => {
    mocks.getRepairItem.mockResolvedValue({
      contentType: "feat",
      importId: IMPORT_ID,
      itemId: ITEM_ID,
      revision: 4,
      candidateName: "Ember Adept",
      data: {
        description: "A synthetic test feat.",
        prerequisites: [],
        action: null,
        recovery: null,
      },
      repairFields: {
        prerequisites: true,
        action: true,
        recovery: false,
        spellcastingAbility: false,
      },
      otherBlockingIssues: 0,
      userEditedFields: [],
    });

    render(await MpmbImportSpellRepairPage({
      params: Promise.resolve({ id: IMPORT_ID, itemId: ITEM_ID }),
    }));

    expect(screen.getByText("Feat repair form for Ember Adept")).toBeVisible();
    expect(screen.queryByText(/additional blocking issue/i)).not.toBeInTheDocument();
  });
});
