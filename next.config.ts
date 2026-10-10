import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev only: let phones on the same network use `npm run dev` via the Mac's IP.
  // DEV_ORIGINS=192.168.10.142 in .env (comma-separated for more than one).
  allowedDevOrigins: (process.env.DEV_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
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
