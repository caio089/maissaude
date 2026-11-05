import { redirect } from "next/navigation"
import { DesktopShell } from "@/components/desktop/shell"
import { getClinicSession } from "@/lib/clinic-session"

export const instant = false

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await getClinicSession()
  if (!session.authenticated) redirect("/desktop/entrar")
  return <DesktopShell initialSession={session}>{children}</DesktopShell>
}
