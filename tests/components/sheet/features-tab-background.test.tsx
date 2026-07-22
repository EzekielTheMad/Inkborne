import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/character/character-context", () => ({
  useResources: () => ({ resources: [], uses: {}, setUsed: vi.fn() }),
}));

import { FeaturesTab } from "@/components/sheet/tabs/features-tab";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { SystemSchemaDefinition } from "@/lib/types/system";

describe("FeaturesTab background feature", () => {
  it("renders a background's nested feature name and description", () => {
    const ref = {
      id: "33333333-3333-4333-8333-333333333333",
      content_definitions: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Lantern Courier",
        slug: "lantern-courier",
        content_type: "background",
        version: 1,
        source: "homebrew",
        data: {
          feature: {
            name: "Known Roads",
            description: "You remember every hidden crossing.",
          },
        },
        effects: [],
      },
      context: {},
      choice_source: "choice:background",
    } as unknown as ContentRefWithContent;
    const schema = {
      content_types: [{ slug: "background", name: "Background" }],
    } as SystemSchemaDefinition;

    render(
      <FeaturesTab
        character={{} as never}
        schema={schema}
        contentRefs={[ref]}
      />,
    );

    expect(screen.getByText("Known Roads")).toBeVisible();
    expect(screen.getByText("You remember every hidden crossing.")).toBeVisible();
    expect(screen.getByText("Lantern Courier Background")).toBeVisible();
  });
});
