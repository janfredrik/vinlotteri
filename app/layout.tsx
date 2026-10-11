import type { Metadata, Viewport } from "next";
import { DevMark } from "@/components/DevMark";
import { RegisterSW } from "@/components/RegisterSW";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const isDev = process.env.NODE_ENV === "development";

export const metadata: Metadata = {
  title: isDev ? "[DEV] Vinlotteri" : "Vinlotteri",
  description: "Vinlotteri på jobb – kjøp lodd, se premier, følg trekningen.",
  appleWebApp: { capable: true, title: "Vinlotteri", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf6ef",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body className="min-h-dvh">
        {isDev && <DevMark />}
        <RegisterSW />
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-plum/60" />
      </body>
    </html>
  );
}
