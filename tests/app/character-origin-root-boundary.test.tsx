import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: vi.fn(), client: vi.fn(), boundary: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/font/google", () => ({ Marcellus: () => ({ variable: "marcellus" }), EB_Garamond: () => ({ variable: "garamond" }) }));
vi.mock("@/components/theme-provider", () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/character/creation-ui-server", () => ({ characterCreationUIEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/components/auth/creation-session-boundary", () => ({ CreationSessionBoundary: (props: unknown) => { mocks.boundary(props); return null; } }));
import RootLayout from "@/app/layout";

beforeEach(() => { vi.resetAllMocks(); });
describe("global creation housekeeping gate", () => {
  it("adds no Auth request or browser boundary to the existing default flow", async () => {
    mocks.enabled.mockReturnValue(false);
    await RootLayout({ children: <p>Existing flow</p> });
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.boundary).not.toHaveBeenCalled();
  });
  it.each([false, true])("passes known account or unknown Auth state without inventing sign-out (error=%s)", async failed => {
    mocks.enabled.mockReturnValue(true);
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "account" } }, error: failed ? { message: "unavailable" } : null }) } });
    const tree = await RootLayout({ children: <p>Prepared flow</p> });
    // Render the body children only; nesting a document inside jsdom's body
    // would test the harness rather than the conditional boundary.
    render(tree.props.children.props.children);
    expect(mocks.boundary.mock.calls[0][0]).toEqual({ accountId: failed ? undefined : "account" });
  });
});
