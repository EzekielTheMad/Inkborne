import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResourceCounter } from "@/components/sheet/resource-counter";
import type { FeatureResource } from "@/lib/types/resources";

function mk(overrides: Partial<FeatureResource> = {}): FeatureResource {
  return {
    slug: "rage",
    name: "Rage",
    max: 3,
    recovery: "long",
    sourceLabel: "Barbarian 1",
    sourceFeatureSlug: "rage",
    ...overrides,
  };
}

describe("ResourceCounter", () => {
  it("renders label and remaining/max", () => {
    render(<ResourceCounter resource={mk()} used={0} onChange={vi.fn()} />);
    expect(screen.getByText("Rage")).toBeInTheDocument();
    expect(screen.getByText("3/3")).toBeInTheDocument();
  });

  it("shows remaining as max minus used", () => {
    render(<ResourceCounter resource={mk()} used={1} onChange={vi.fn()} />);
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("calls onChange(used+1) when decrement clicked", () => {
    const onChange = vi.fn();
    render(<ResourceCounter resource={mk()} used={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /use one/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("calls onChange(used-1) when increment clicked", () => {
    const onChange = vi.fn();
    render(<ResourceCounter resource={mk()} used={2} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /restore one/i }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("decrement button is disabled at used === max", () => {
    render(<ResourceCounter resource={mk()} used={3} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /use one/i })).toBeDisabled();
  });

  it("increment button is disabled at used === 0", () => {
    render(<ResourceCounter resource={mk()} used={0} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /restore one/i })).toBeDisabled();
  });

  it("card layout shows source label", () => {
    render(<ResourceCounter resource={mk()} used={0} onChange={vi.fn()} layout="card" />);
    expect(screen.getByText(/Barbarian 1/i)).toBeInTheDocument();
  });

  it("widget layout does not show source label", () => {
    render(<ResourceCounter resource={mk()} used={0} onChange={vi.fn()} layout="widget" />);
    expect(screen.queryByText(/Barbarian 1/i)).not.toBeInTheDocument();
  });
});
