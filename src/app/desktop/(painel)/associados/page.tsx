import type { Metadata } from "next"
import { AssociatesView } from "@/components/desktop/associates-view"
import { getClinicSession } from "@/lib/clinic-session"

export const metadata: Metadata = { title: "Associados" }

export default async function AssociatesPage() {
  const session = await getClinicSession()
  return <AssociatesView initialRole={session.role} />
}
