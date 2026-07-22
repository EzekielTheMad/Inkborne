import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContentPreview } from "@/components/builder/content-preview";

describe("ContentPreview background feature", () => {
  it("shows the finite nested feature before selection", () => {
    render(
      <ContentPreview
        content={{
          id: "11111111-1111-4111-8111-111111111111",
          name: "Lantern Courier",
          slug: "lantern-courier",
          content_type: "background",
          version: 2,
          source: "homebrew",
          data: {
            feature: {
              name: "Known Roads",
              description: "You remember every hidden crossing.",
            },
          },
          effects: [],
        }}
        contentTypeLabel="Background"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Known Roads")).toBeVisible();
    expect(screen.getByText("You remember every hidden crossing.")).toBeVisible();
  });
});
