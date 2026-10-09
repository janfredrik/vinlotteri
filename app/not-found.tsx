import type { Metadata } from "next";
import NotFoundView from "@/components/NotFoundView";

export const metadata: Metadata = { title: "Fant ikke siden · Vinlotteri" };

export default function NotFound() {
  return (
    <NotFoundView
      title="Den ruta finnes ikke"
      body="Lenken er kanskje gammel, eller så ble det trillet litt for hardt."
    />
  );
}
