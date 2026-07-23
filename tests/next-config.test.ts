import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

describe("legacy authoring redirects", () => {
  it("temporarily redirects only the former Library authoring routes to Homebrew", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual(expect.arrayContaining([
      {
        source: "/library/import/:path*",
        destination: "/homebrew/import/:path*",
        permanent: false,
      },
      {
        source: "/library/spells/new",
        destination: "/homebrew/spells/new",
        permanent: false,
      },
      {
        source: "/library/spells/:id/edit",
        destination: "/homebrew/spells/:id/edit",
        permanent: false,
      },
      {
        source: "/library/feats/new",
        destination: "/homebrew/feats/new",
        permanent: false,
      },
      {
        source: "/library/feats/:id/edit",
        destination: "/homebrew/feats/:id/edit",
        permanent: false,
      },
      {
        source: "/library/backgrounds/new",
        destination: "/homebrew/backgrounds/new",
        permanent: false,
      },
      {
        source: "/library/backgrounds/:id/edit",
        destination: "/homebrew/backgrounds/:id/edit",
        permanent: false,
      },
    ]));
    expect(redirects).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/library" }),
    ]));
  });
});
