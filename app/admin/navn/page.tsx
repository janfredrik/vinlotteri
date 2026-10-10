import NameCleanup from "@/components/admin/NameCleanup";

export const dynamic = "force-dynamic";

/** Not linked from anywhere: the organiser opens /admin/navn by hand to tidy up nicknames. */
export default function NamesPage() {
  return <NameCleanup />;
}
