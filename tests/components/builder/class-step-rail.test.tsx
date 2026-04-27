import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import type { ContentEntry } from "@/components/builder/content-browser";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LevelPill", () => {
  it("renders the level number and summary", () => {
    render(<LevelPill level={3} summary="Sacred Oath" hasUnmadeChoice={false} active={false} onClick={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Sacred Oath")).toBeInTheDocument();
  });

  it("shows the unmade-choice indicator when hasUnmadeChoice is true", () => {
    render(<LevelPill level={4} summary="ASI" hasUnmadeChoice={true} active={false} onClick={vi.fn()} />);
    expect(screen.getByLabelText("Has unmade choice")).toBeInTheDocument();
  });

  it("hides the unmade-choice indicator when hasUnmadeChoice is false", () => {
    render(<LevelPill level={1} summary="Divine Sense" hasUnmadeChoice={false} active={false} onClick={vi.fn()} />);
    expect(screen.queryByLabelText("Has unmade choice")).not.toBeInTheDocument();
  });

  it("marks the active pill with aria-current='true'", () => {
    render(<LevelPill level={2} summary="Fighting Style" hasUnmadeChoice={false} active={true} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /level 2/i })).toHaveAttribute("aria-current", "true");
  });

  it("calls onClick when activated", () => {
    const onClick = vi.fn();
    render(<LevelPill level={2} summary="Fighting Style" hasUnmadeChoice={false} active={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /level 2/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

function passiveFeature(): ContentEntry {
  return {
    id: "f1",
    slug: "divine-sense",
    name: "Divine Sense",
    content_type: "feature",
    data: { description: "Detect celestials, fiends, undead.", level: 1, class: "paladin" },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("FeatureCard", () => {
  it("renders the feature name and description", () => {
    render(<FeatureCard feature={passiveFeature()} />);
    expect(screen.getByText("Divine Sense")).toBeInTheDocument();
    expect(screen.getByText("Detect celestials, fiends, undead.")).toBeInTheDocument();
  });

  it("renders without a description if absent", () => {
    const f = passiveFeature();
    f.data = { level: 1, class: "paladin" };
    render(<FeatureCard feature={f} />);
    expect(screen.getByText("Divine Sense")).toBeInTheDocument();
  });
});
