import AdminRound from "@/components/admin/AdminRound";

export const dynamic = "force-dynamic";

export default async function AdminRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  return <AdminRound roundId={id} />;
}
