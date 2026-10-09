import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Internal office site: keep it out of search engines (also covers API/non-HTML responses).
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "bilder.vinmonopolet.no" },
    ],
  },
};

export default nextConfig;
