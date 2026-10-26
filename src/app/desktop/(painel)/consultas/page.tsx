import type { Metadata } from "next"
import { ConsultationsView } from "@/components/desktop/consultations-view"

export const metadata: Metadata = { title: "Consultas" }

export default function ConsultationsPage() {
  return <ConsultationsView />
}
