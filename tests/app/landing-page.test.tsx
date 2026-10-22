import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/landing/landing-content", () => ({
  LandingContent: () => <main aria-label="Public notebook homepage" />,
}));

import LandingPage from "@/app/page";

// Invoke the async server entrypoint directly to isolate its existing auth
// decision. Browser tests exercise the actual rendered anonymous Next.js page.
describe("homepage server authentication gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`REDIRECT:${destination}`);
    });
  });

  it("returns the public notebook homepage for an anonymous visitor", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    render(await LandingPage());

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("main", { name: "Public notebook homepage" })).toBeInTheDocument();
  });

  it("keeps the signed-in redirect to the dashboard", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "local-auth-gate-fixture" } } });

    await expect(LandingPage()).rejects.toThrow("REDIRECT:/dashboard");

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/dashboard");
  });
});
