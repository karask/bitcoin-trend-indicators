import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthBoundary } from "./AuthClient";

const themeInitializer = `(function(){try{var saved=localStorage.getItem("crypto-regime-theme");var dark=saved==="dark"||(saved!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=dark?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})();`;

export const metadata: Metadata = {
  metadataBase: new URL("https://bitcoin-trend-indicators.pages.dev"),
  title: { default: "Crypto Regime Lab", template: "%s · Crypto Regime Lab" },
  description: "Transparent daily and weekly BTC, ETH, SOL, DOGE, LINK, XMR, and SUI trend-regime research.",
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f1eb" },
    { media: "(prefers-color-scheme: dark)", color: "#101714" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitializer }} /></head><body><AuthBoundary>{children}</AuthBoundary></body></html>;
}
