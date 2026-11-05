import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { FinanceView } from "@/components/desktop/finance-view"
import { Button } from "@/components/ui/button"
import { getClinicSession } from "@/lib/clinic-session"

export const metadata: Metadata = { title: "Financeiro" }

export default async function FinancePage() {
  const session = await getClinicSession()

  if (session.role === "attendant") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <ShieldAlert className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Acesso Restrito
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Módulo restrito à administração da clínica. Sua conta possui perfil de recepção/atendimento e não tem permissão para visualizar relatórios financeiros, fluxo de caixa ou cobranças.
        </p>
        <div className="mt-6">
          <Button asChild variant="default">
            <Link href="/desktop">
              <ArrowLeft className="mr-2 size-4" />
              Voltar ao painel
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return <FinanceView />
}
