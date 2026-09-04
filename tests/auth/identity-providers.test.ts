import { describe, expect, it } from "vitest";

import { resolveIdentityLinkStatus } from "@/lib/auth/identity-providers";

describe("resolveIdentityLinkStatus", () => {
  it("reconciles a transient callback error with the freshly connected identity", () => {
    expect(resolveIdentityLinkStatus({
      requestedLinkedProvider: null,
      requestedLinkErrorProvider: "google",
      currentProviders: ["email", "google"],
    })).toEqual({ linkedProvider: "google", linkErrorProvider: null });
  });

  it("reports an allowed provider as failed when it is still absent", () => {
    expect(resolveIdentityLinkStatus({
      requestedLinkedProvider: "discord",
      requestedLinkErrorProvider: null,
      currentProviders: ["email"],
    })).toEqual({ linkedProvider: null, linkErrorProvider: "discord" });
  });

  it("ignores unsupported provider markers", () => {
    expect(resolveIdentityLinkStatus({
      requestedLinkedProvider: "github",
      requestedLinkErrorProvider: null,
      currentProviders: ["email", "github"],
    })).toEqual({ linkedProvider: null, linkErrorProvider: null });
  });
});
