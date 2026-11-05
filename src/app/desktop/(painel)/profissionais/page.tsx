import type { Metadata } from "next"
import { ProfessionalsView } from "@/components/desktop/professionals-view"
import { getClinicSession } from "@/lib/clinic-session"

export const metadata: Metadata = { title: "Profissionais" }

export default async function ProfessionalsPage() {
  const session = await getClinicSession()
  return <ProfessionalsView initialRole={session.role} />
}
