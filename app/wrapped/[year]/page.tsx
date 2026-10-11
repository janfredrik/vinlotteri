import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { readMe } from "@/lib/me-cookie";
import { isSuper } from "@/lib/http";
import { buildPersonWrap, buildYearWrap, isWrappedOpen, loadYear, wrappedYears } from "@/lib/wrapped";
import WrappedStory from "@/components/wrapped/WrappedStory";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#2c0a14" };

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  return { title: `Årgang ${(await params).year} – Vinlotteri` };
}

export default async function WrappedPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const year = Number((await params).year);
  // The superadmin can look at a year before releasing it.
  const visible = isWrappedOpen(year) || ((await isSuper()) && wrappedYears().some((y) => y.year === year));
  if (!Number.isInteger(year) || !visible) notFound();
  const { rounds, earlier } = loadYear(year);
  if (!rounds.length) notFound();

  const big = (await searchParams).vis === "storskjerm";
  const me = big ? null : await readMe();
  return (
    <WrappedStory
      wrap={buildYearWrap(year, rounds, earlier)}
      person={me ? buildPersonWrap(me, rounds, earlier) : null}
      me={me}
      big={big}
    />
  );
}
