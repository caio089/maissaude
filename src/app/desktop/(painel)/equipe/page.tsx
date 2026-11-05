import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { TeamView } from "@/components/desktop/team-view"
import { getClinicSession } from "@/lib/clinic-session"

export const metadata: Metadata = {
  title: "Gestão da Equipe",
}

export default async function EquipePage() {
  const session = await getClinicSession()
  if (session.role !== "admin") {
    redirect("/desktop")
  }

  return <TeamView initialSession={session} />
}
