import { redirect } from "next/navigation"
import { DesktopShell } from "@/components/desktop/shell"
import { hasClinicSession } from "@/lib/clinic-session"

export const instant = false

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasClinicSession())) redirect("/desktop/entrar")
  return <DesktopShell>{children}</DesktopShell>
}
