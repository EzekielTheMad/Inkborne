import type { Metadata } from "next";
import { Marcellus, EB_Garamond } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { CreationSessionBoundary } from "@/components/auth/creation-session-boundary";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

/**
 * Journey display faces (see docs/design-briefs/design_handoff_journey_alpha).
 * Marcellus is the manuscript display face; EB Garamond italic is the
 * flourish/marginalia face. Both are exposed as CSS variables consumed by
 * the `.j-display` / `.j-display-italic` helpers in globals.css.
 */
const marcellus = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marcellus",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inkborne",
  description: "Character and campaign management for tabletop RPGs",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const creationEnabled = characterCreationUIEnabled();
  let creationAccount: string | null | undefined;
  if (creationEnabled) {
    try {
      const client = await createClient();
      const { data, error } = await client.auth.getUser();
      if (!error) creationAccount = data.user?.id ?? null;
    } catch { /* Unknown Auth state preserves the pending record. */ }
  }
  return (
    <html
      lang="en"
      className={`dark h-full antialiased ${marcellus.variable} ${ebGaramond.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          {creationEnabled && <CreationSessionBoundary accountId={creationAccount} />}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
