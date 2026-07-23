import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  async redirects() {
    return [
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
    ];
  },
};

export default nextConfig;
