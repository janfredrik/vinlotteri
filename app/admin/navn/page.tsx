import { redirect } from "next/navigation";

/** Name cleanup moved to /superadmin; old bookmarks land there. */
export default function NamesPage() {
  redirect("/superadmin/navn");
}
