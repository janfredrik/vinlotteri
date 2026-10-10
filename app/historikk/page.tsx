import HistoryView from "@/components/HistoryView";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ar = (await searchParams).ar;
  return <HistoryView ar={typeof ar === "string" ? ar : undefined} />;
}
