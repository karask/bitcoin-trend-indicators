import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BTC Regime Lab", template: "%s · BTC Regime Lab" },
  description: "Transparent daily and weekly Bitcoin trend-regime research.",
  applicationName: "BTC Regime Lab",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png", apple: "/icon-192.png" },
  openGraph: {
    title: "BTC Regime Lab",
    description: "Trend regimes, without the black box.",
    type: "website",
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "BTC Regime Lab trend chart" }],
  },
  twitter: { card: "summary_large_image", title: "BTC Regime Lab", description: "Trend regimes, without the black box.", images: ["/og-card.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
