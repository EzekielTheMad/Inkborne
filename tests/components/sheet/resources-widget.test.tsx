import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResourcesWidget } from "@/components/sheet/resources-widget";
import type { FeatureResource } from "@/lib/types/resources";

const mkResource = (overrides: Partial<FeatureResource> = {}): FeatureResource => ({
  slug: "rage",
  name: "Rage",
  max: 3,
  recovery: "long",
  sourceLabel: "Barbarian 1",
  sourceFeatureSlug: "rage",
  ...overrides,
});

let useResourcesMock: () => {
  resources: FeatureResource[];
  uses: Record<string, number>;
  spend: (slug: string) => void;
  restore: (slug: string) => void;
  setUsed: (slug: string, n: number) => void;
};

vi.mock("@/lib/character/character-context", () => ({
  useResources: () => useResourcesMock(),
}));

describe("ResourcesWidget", () => {
  it("returns null when no resources", () => {
    useResourcesMock = () => ({
      resources: [],
      uses: {},
      spend: vi.fn(),
      restore: vi.fn(),
      setUsed: vi.fn(),
    });
    const { container } = render(<ResourcesWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Short Rest group when only short-rest resources exist", () => {
    useResourcesMock = () => ({
      resources: [mkResource({ slug: "ki", name: "Ki", recovery: "short", max: 5 })],
      uses: {},
      spend: vi.fn(),
      restore: vi.fn(),
      setUsed: vi.fn(),
    });
    render(<ResourcesWidget />);
    expect(screen.getByText(/Short Rest/i)).toBeInTheDocument();
    expect(screen.queryByText(/Long Rest/i)).not.toBeInTheDocument();
    expect(screen.getByText("Ki")).toBeInTheDocument();
  });

  it("renders both groups when resources span recovery types", () => {
    useResourcesMock = () => ({
      resources: [
        mkResource({ slug: "ki", name: "Ki", recovery: "short", max: 5 }),
        mkResource({ slug: "rage", name: "Rage", recovery: "long", max: 3 }),
      ],
      uses: {},
      spend: vi.fn(),
      restore: vi.fn(),
      setUsed: vi.fn(),
    });
    render(<ResourcesWidget />);
    expect(screen.getByText(/Short Rest/i)).toBeInTheDocument();
    expect(screen.getByText(/Long Rest/i)).toBeInTheDocument();
  });

  it("sorts resources alphabetically within groups", () => {
    useResourcesMock = () => ({
      resources: [
        mkResource({ slug: "rage", name: "Rage", recovery: "long" }),
        mkResource({ slug: "lay_on_hands", name: "Lay on Hands", recovery: "long" }),
      ],
      uses: {},
      spend: vi.fn(),
      restore: vi.fn(),
      setUsed: vi.fn(),
    });
    render(<ResourcesWidget />);
    const names = screen.getAllByText(/Rage|Lay on Hands/).map((el) => el.textContent);
    const lay = names.indexOf("Lay on Hands");
    const rage = names.indexOf("Rage");
    expect(lay).toBeLessThan(rage);
  });
});
