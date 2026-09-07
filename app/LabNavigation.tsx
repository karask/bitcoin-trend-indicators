/* eslint-disable @next/next/no-html-link-for-pages -- Cloudflare Pages serves independent static shells. */
export default function LabNavigation({ current }: { current: "crypto" | "stocks" | "overview" }) {
  return <nav className="lab-nav" aria-label="Research labs"><a href="/" aria-current={current === "crypto" ? "page" : undefined}>Crypto</a><a href="/stocks/" aria-current={current === "stocks" ? "page" : undefined}>Stocks</a><a href="/overview/" aria-current={current === "overview" ? "page" : undefined}>Overview</a></nav>;
}
