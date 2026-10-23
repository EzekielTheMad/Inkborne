import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

afterEach(() => vi.unstubAllEnvs());
describe("Auth provider presentation", () => {
  it("retains Google and hides Discord unless explicitly enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_AUTH_ENABLED", "false");
    const onSelect = vi.fn(); render(<OAuthButtons onSelect={onSelect} />);
    expect(screen.queryByRole("button", { name: "Continue with Discord" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(onSelect).toHaveBeenCalledWith("google");
  });
  it("retains the enabled Discord callback and non-submit button semantics", () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_AUTH_ENABLED", "true");
    const onSelect = vi.fn(); render(<OAuthButtons onSelect={onSelect} />);
    const discord = screen.getByRole("button", { name: "Continue with Discord" });
    expect(discord).toHaveAttribute("type", "button");
    fireEvent.click(discord);
    expect(onSelect).toHaveBeenCalledWith("discord");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveAttribute("type", "button");
  });
});
