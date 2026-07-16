import type { Metadata } from "next";
import { Marcellus, EB_Garamond } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark h-full antialiased ${marcellus.variable} ${ebGaramond.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
