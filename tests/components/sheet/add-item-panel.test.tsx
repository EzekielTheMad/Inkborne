import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddItemPanel } from "@/components/sheet/inventory/add-item-panel";
import { searchItems } from "@/lib/supabase/inventory";

vi.mock("@/lib/supabase/inventory", () => ({
  searchItems: vi.fn().mockResolvedValue([
    {
      id: "c1",
      name: "Longsword",
      slug: "longsword",
      content_type: "weapon",
      data: { damage: { dice: "1d8", type: "slashing" }, weight: 3 },
      effects: [],
    },
  ]),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddItemPanel", () => {
  it("returns null when closed", () => {
    const { container } = render(
      <AddItemPanel
        open={false}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders search input and filter pills when open", () => {
    render(
      <AddItemPanel
        open={true}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );
    expect(
      screen.getByPlaceholderText(/search items/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /armor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /weapon/i })).toBeInTheDocument();
  });

  it("clicking a filter pill toggles it", () => {
    render(
      <AddItemPanel
        open={true}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );
    const armorPill = screen.getByRole("button", { name: /armor/i });
    fireEvent.click(armorPill);
    // The pill's class should reflect selected state (character color tone applied).
    expect(armorPill.className).toContain("bg-character-bg");
  });

  it("clicking custom item button shows the form", () => {
    render(
      <AddItemPanel
        open={true}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );
    const button = screen.getByRole("button", { name: /custom item/i });
    fireEvent.click(button);
    expect(screen.getByPlaceholderText(/item name/i)).toBeInTheDocument();
  });

  it("shows a retryable error when the content search fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(searchItems).mockRejectedValueOnce({
      code: "42501",
      message: "permission denied",
    });

    render(
      <AddItemPanel
        open={true}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );

    expect(
      await screen.findByText(/items could not be loaded/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });
});
