import type { Metadata } from "next"
import { ProfessionalsView } from "@/components/desktop/professionals-view"

export const metadata: Metadata = { title: "Profissionais" }

export default function ProfessionalsPage() {
  return <ProfessionalsView />
}
