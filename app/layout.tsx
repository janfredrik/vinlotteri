import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/RegisterSW";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vinlotteri",
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
        <RegisterSW />
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-plum/60" />
      </body>
    </html>
  );
}
