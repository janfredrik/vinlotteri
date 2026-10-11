import { redirect } from "next/navigation";
import { wrappedYears } from "@/lib/wrapped";

export const dynamic = "force-dynamic";

/** The newest year that is open, else the history. */
export default function WrappedIndex() {
  const open = wrappedYears().find((y) => y.open);
  redirect(open ? `/wrapped/${open.year}` : "/historikk");
}
