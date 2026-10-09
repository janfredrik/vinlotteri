import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vinlotteri",
    short_name: "Vinlotteri",
    description: "Vinlotteri på jobb – kjøp lodd, se premier, følg trekningen.",
    lang: "nb",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf6ef",
    theme_color: "#fbf6ef",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
