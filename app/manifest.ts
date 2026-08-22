import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BTC Regime Lab",
    short_name: "Regime Lab",
    description: "Transparent daily and weekly Bitcoin trend-regime research.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f1eb",
    theme_color: "#17231f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
