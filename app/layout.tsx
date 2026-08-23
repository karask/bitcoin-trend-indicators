import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Crypto Regime Lab", template: "%s · Crypto Regime Lab" },
  description: "Transparent daily and weekly BTC, ETH, and SOL trend-regime research.",
  applicationName: "Crypto Regime Lab",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png", apple: "/icon-192.png" },
  openGraph: {
    title: "Crypto Regime Lab",
    description: "Trend regimes, without the black box.",
    type: "website",
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "Crypto Regime Lab trend chart" }],
  },
  twitter: { card: "summary_large_image", title: "Crypto Regime Lab", description: "Trend regimes, without the black box.", images: ["/og-card.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
