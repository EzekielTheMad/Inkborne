import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPreview: vi.fn(),
  getUser: vi.fn(),
  confirm: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/mpmb-imports-server", () => ({
  getOwnedMpmbImportPreview: mocks.getPreview,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/app/(app)/library/import/actions", () => ({
  confirmMpmbImportPreview: mocks.confirm,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

import MpmbImportPreviewPage from "@/app/(app)/library/import/[id]/preview/page";

const IMPORT_ID = "33333333-3333-4333-8333-333333333333";

const preview = {
  id: IMPORT_ID,
  originalFilename: "fixture.mpmb",
  revision: 4,
  previewValidated: false,
  calculation: {
    passed: true,
    assumptions: {
      levels: [1, 5, 11, 17],
      abilityScore: 10,
      castingAbilityScore: 16,
      spellSaveDc: 13,
      spellAttackBonus: 5,
      equipment: "No armor, shield, active effects, or other content",
    },
    items: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        contentType: "feat" as const,
        name: "Steadfast Adept",
        status: "passed" as const,
        levels: [{
          level: 1,
          abilities: [{
            slug: "dexterity",
            label: "Dexterity",
            before: 10,
            after: 11,
            delta: 1,
          }],
          derivedStats: [],
          speed: [{
            slug: "walk",
            label: "walk speed",
            before: 30,
            after: 35,
            delta: 5,
          }],
          visionAdded: [],
          damageResistancesAdded: ["fire"],
          saveAdvantagesAdded: [],
          saveImmunitiesAdded: [],
        }],
        narratives: [],
        grants: [],
        warnings: ["skill proficiencies are stored for reference but are not automated yet."],
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        contentType: "spell" as const,
        name: "Ember Lance",
        status: "passed" as const,
        castingTime: "1 action",
        range: "60 feet",
        components: ["V", "S"],
        concentration: false,
        ritual: false,
        casts: [{
          label: "Base cast (level 1)",
          characterLevel: 1,
          castLevel: 1,
          rolls: [{ kind: "damage" as const, label: "Ember Lance — Damage", expression: "1d8+3" }],
          dc: { ability: "dexterity", value: 13, success: "half" as const },
          persistentEffect: false,
        }],
        warnings: [],
      },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  mocks.getPreview.mockResolvedValue(preview);
});

describe("MpmbImportPreviewPage", () => {
  it("shows assumptions, feat deltas, spell casts, warnings, and confirmation", async () => {
    render(await MpmbImportPreviewPage({
      params: Promise.resolve({ id: IMPORT_ID }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "Preview imported content" })).toBeVisible();
    expect(screen.getByText(/Levels 1, 5, 11, 17/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Steadfast Adept" })).toBeVisible();
    expect(screen.getByText(/10 → 11/)).toBeVisible();
    expect(screen.getByText(/30 → 35/)).toBeVisible();
    expect(screen.getByText(/skill proficiencies/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ember Lance" })).toBeVisible();
    expect(screen.getByText("1d8+3")).toBeVisible();
    expect(screen.getAllByText(/DC 13/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Confirm calculations" })).toBeEnabled();
  });

  it("disables confirmation when any calculation fails", async () => {
    mocks.getPreview.mockResolvedValue({
      ...preview,
      calculation: {
        ...preview.calculation,
        passed: false,
        items: [{
          id: "66666666-6666-4666-8666-666666666666",
          contentType: "spell",
          name: "Broken Bolt",
          status: "failed",
          message: "Malformed dice expression.",
        }],
      },
    });

    render(await MpmbImportPreviewPage({
      params: Promise.resolve({ id: IMPORT_ID }),
      searchParams: Promise.resolve({ error: "Fix the calculation." }),
    }));

    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Fix the calculation.");
    expect(screen.getByText("Malformed dice expression.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm calculations" })).toBeDisabled();
  });

  it("shows the current confirmed revision without a second mutation control", async () => {
    mocks.getPreview.mockResolvedValue({ ...preview, previewValidated: true });

    render(await MpmbImportPreviewPage({
      params: Promise.resolve({ id: IMPORT_ID }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByText("Revision confirmed")).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to import" })).toHaveAttribute(
      "href",
      `/library/import/${IMPORT_ID}`,
    );
    expect(screen.queryByRole("button", { name: "Confirm calculations" })).not.toBeInTheDocument();
  });

  it("does not reveal another user's missing preview", async () => {
    mocks.getPreview.mockResolvedValue(null);
    await expect(MpmbImportPreviewPage({
      params: Promise.resolve({ id: IMPORT_ID }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NOT_FOUND");
  });
});
