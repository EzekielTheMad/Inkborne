import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppLayout from "@/app/(app)/layout";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1", email: "tester@example.com" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { display_name: "Alpha Tester", avatar_url: null },
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/is-admin", () => ({ isAdminUserId: () => false }));
vi.mock("@/components/error/error-listeners", () => ({ ErrorListeners: () => null }));
vi.mock("@/components/nav/app-nav", () => ({ AppNav: () => <div>Desktop navigation</div> }));
vi.mock("@/components/nav/mobile-nav", () => ({ MobileNav: () => <div>Mobile navigation</div> }));

describe("AppLayout", () => {
  it("keeps authenticated navigation visible while page content scrolls", async () => {
    render(await AppLayout({ children: <div>Page content</div> }));

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sticky", "top-0", "z-40");
    expect(screen.getByText("Page content")).toBeVisible();
  });
});
