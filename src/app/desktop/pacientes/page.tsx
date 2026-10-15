import type { Metadata } from "next"
import { PatientsView } from "@/components/desktop/patients-view"

export const metadata: Metadata = { title: "Pacientes" }

export default function PatientsPage() {
  return <PatientsView />
}
