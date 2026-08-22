import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.16"],
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
