import type { Metadata } from "next"
import { DashboardView } from "@/components/desktop/dashboard-view"
import { getClinicSession } from "@/lib/clinic-session"

export const metadata: Metadata = { title: "Painel" }

export default async function DesktopHomePage() {
  const session = await getClinicSession()
  return <DashboardView initialRole={session.role} />
}
