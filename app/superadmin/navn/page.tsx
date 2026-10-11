import { redirect } from "next/navigation";
import NameCleanup from "@/components/admin/NameCleanup";
import { isSuper } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function NamesPage() {
  if (!(await isSuper())) redirect("/superadmin");
  return <NameCleanup />;
}
