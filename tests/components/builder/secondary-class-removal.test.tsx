import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassStepRail, type ClassStepRailProps } from "@/components/builder/class-step-rail";
import type { ContentEntry } from "@/components/builder/content-browser";

const layout = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/builder/use-is-mobile", () => ({ useIsMobile: () => layout.mobile }));

const originalId = "30000000-0000-4000-8000-000000000001";
const secondaryId = "30000000-0000-4000-8000-000000000002";
const classes: ContentEntry[] = ["fighter", "cleric"].map(slug => ({ id: slug, version: 1, slug,
  name: slug === "fighter" ? "Fighter" : "Cleric", content_type: "class", effects: [], source: "srd",
  data: { hit_die: 8, levels: Array.from({ length: 4 }, (_, i) => ({ level: i + 1, features: [] })) } }));
const selectedClasses = [{ slug: "fighter", level: 4, occurrence_id: originalId },
  { slug: "cleric", level: 2, occurrence_id: secondaryId }];
function props(): ClassStepRailProps {
  return { classes, selectedClasses, originalOccurrenceId: originalId, classRemovalAvailable: true,
    subclasses: [], features: [], localChoices: { classes: selectedClasses }, resolvedStats: {},
    hpRule: "free_choice", hpRolls: {}, onLevelChange: vi.fn(), onRemoveClass: vi.fn(),
    onSubclassSelect: vi.fn(), onAsiSelect: vi.fn(), onFightingStyleSelect: vi.fn(), onChoiceSelect: vi.fn(),
    onAddClass: vi.fn(), onConfirmLevelUp: vi.fn(), onCancelLevelUp: vi.fn(), onHpRollChange: vi.fn() };
}

describe("Added-class removal controls", () => {
  beforeEach(() => { layout.mobile = false; vi.restoreAllMocks(); });

  it("keeps the proven starting class fixed and confirms removal only for an added class on desktop", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const value = props();
    render(<ClassStepRail {...value} />);
    expect(screen.getByText("Starting class · fixed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Fighter" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Cleric" }));
    expect(confirm).toHaveBeenCalledWith("Remove Cleric from this character? This will also remove any subclass and choices made for it.");
    expect(value.onRemoveClass).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("offers the same added-class removal through the mobile menu", async () => {
    layout.mobile = true;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const value = props();
    render(<ClassStepRail {...value} />);
    expect(screen.getByText("Starting class · fixed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More options for Fighter" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More options for Cleric" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove Cleric" }));
    expect(value.onRemoveClass).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("offers no removal when the native original occurrence is unavailable", () => {
    render(<ClassStepRail {...props()} originalOccurrenceId={null} />);
    expect(screen.queryByRole("button", { name: /Remove (Fighter|Cleric)/ })).not.toBeInTheDocument();
  });

  it("returns the selected detail to a retained class after the selected secondary class is removed", () => {
    const value = props();
    const { rerender } = render(<ClassStepRail {...value} />);
    fireEvent.click(screen.getAllByRole("button", { name: /level 2/i })[1]);
    expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Cleric")).toBeInTheDocument();
    rerender(<ClassStepRail {...value} selectedClasses={[selectedClasses[0]]} localChoices={{ classes: [selectedClasses[0]] }} />);
    expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Fighter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Level 4" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Fighter" })).not.toBeInTheDocument();
  });
});
