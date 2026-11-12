import type { Metadata } from "next"
import { ClinicsView } from "@/components/desktop/clinics-view"

export const metadata: Metadata = {
  title: "Clínicas Parceiras | CuidarSaude",
  description: "Gerenciamento de clínicas parceiras e rede credenciada.",
}

export default function ClinicsPage() {
  return <ClinicsView />
}
