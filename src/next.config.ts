import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // 3 Mo : photo de 2 Mo max + surcoût multipart. Les imports CSV passent aussi par une server action.
    serverActions: { bodySizeLimit: "3mb" },
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
