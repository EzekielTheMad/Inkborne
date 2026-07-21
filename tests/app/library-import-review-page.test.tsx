import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getReview: vi.fn(),
  getUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/mpmb-imports-server", () => ({
  getOwnedMpmbImportReview: mocks.getReview,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/components/library/mpmb-import-selection-button", () => ({
  MpmbImportSelectionButton: ({ selected }: { selected: boolean }) => (
    <button>{selected ? "Selected" : "Skipped"}</button>
  ),
}));

import MpmbImportReviewPage from "@/app/(app)/library/import/[id]/page";

const IMPORT_ID = "33333333-3333-4333-8333-333333333333";

const review = {
  id: IMPORT_ID,
  originalFilename: "fixture.mpmb",
  sourceBytes: 1024,
  sourceSha256: "a".repeat(64),
  parserVersion: "1.0.0",
  mapperVersion: "1.0.0",
  requiredSheetVersion: "13.1.14",
  status: "review" as const,
  revision: 2,
  summary: {
    valid: 1,
    needsInfo: 1,
    unsupported: 1,
    warnings: 1,
    blockingIssues: 2,
  },
  items: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      ordinal: 0,
      registry: "SpellsList" as const,
      sourceKey: "ember ward",
      contentType: "spell" as const,
      location: { line: 5, column: 1 },
      mappingStatus: "valid" as const,
      candidateName: "Ember Ward",
      selected: true,
      committedContentId: null,
      repairable: false,
      userEditedFields: [],
      userEditedAt: null,
      diagnostics: [{
        code: "source.unknown.PHB",
        severity: "warning" as const,
        message: "Source metadata was not included.",
      }],
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      ordinal: 1,
      registry: "FeatsList" as const,
      sourceKey: "cross-trained",
      contentType: "feat" as const,
      location: { line: 17, column: 1 },
      mappingStatus: "needs_info" as const,
      candidateName: "Cross-Trained",
      selected: false,
      committedContentId: null,
      repairable: false,
      userEditedFields: [],
      userEditedAt: null,
      diagnostics: [{
        code: "feat.prerequisite.compound",
        severity: "blocking" as const,
        message: "Choose an exact prerequisite.",
      }],
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      ordinal: 2,
      registry: "SpellsList" as const,
      sourceKey: "ash veil",
      contentType: "spell" as const,
      location: { line: 25, column: 1 },
      mappingStatus: "needs_info" as const,
      candidateName: "Ash Veil",
      selected: false,
      committedContentId: null,
      repairable: true,
      userEditedFields: [],
      userEditedAt: null,
      diagnostics: [{
        code: "spell.material.required",
        severity: "blocking" as const,
        message: "Add the material component text.",
      }],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  mocks.getReview.mockResolvedValue(review);
});

describe("MpmbImportReviewPage", () => {
  it("shows ordered statuses, diagnostics, selection, and the private boundary", async () => {
    render(await MpmbImportReviewPage({
      params: Promise.resolve({ id: IMPORT_ID }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "fixture.mpmb" })).toBeVisible();
    expect(screen.getByText("Ember Ward")).toBeVisible();
    expect(screen.getByText("Cross-Trained")).toBeVisible();
    expect(screen.getByText("Ash Veil")).toBeVisible();
    expect(screen.getAllByText("Ready")).toHaveLength(2);
    expect(screen.getAllByText("Needs review")).toHaveLength(2);
    expect(screen.getByText(/feat\.prerequisite\.compound/)).toBeVisible();
    expect(screen.getByText(/database records their provenance/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Import 1" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Add missing details" })).toHaveAttribute(
      "href",
      `/library/import/${IMPORT_ID}/items/77777777-7777-4777-8777-777777777777/edit`,
    );
  });

  it("renders a committed notice and removes mutation controls", async () => {
    mocks.getReview.mockResolvedValue({
      ...review,
      status: "completed",
      items: review.items.map((item) => ({
        ...item,
        committedContentId: item.mappingStatus === "valid"
          ? "66666666-6666-4666-8666-666666666666"
          : null,
      })),
    });

    render(await MpmbImportReviewPage({
      params: Promise.resolve({ id: IMPORT_ID }),
      searchParams: Promise.resolve({ committed: "1" }),
    }));

    expect(screen.getByText("1 definition added to your private library.")).toBeVisible();
    expect(screen.getByText("Committed")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Import/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add missing details" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View library" })).toBeVisible();
  });

  it("does not reveal another user's missing review", async () => {
    mocks.getReview.mockResolvedValue(null);
    await expect(MpmbImportReviewPage({
      params: Promise.resolve({ id: IMPORT_ID }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NOT_FOUND");
  });
});
