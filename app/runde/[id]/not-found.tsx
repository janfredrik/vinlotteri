import type { Metadata } from "next";
import NotFoundView from "@/components/NotFoundView";

export const metadata: Metadata = { title: "Fant ikke runden · Vinlotteri" };

export default function RoundNotFound() {
  return (
    <NotFoundView
      title="Fant ikke runden"
      body="Runden er slettet, eller lenken peker på en som aldri fantes. Den aktive runden ligger alltid på forsiden."
    />
  );
}
