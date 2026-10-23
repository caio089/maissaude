import type { Metadata } from "next"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { ClinicLoginForm } from "@/components/desktop/clinic-login-form"

export const metadata: Metadata = { title: "Entrar no painel" }

export default function ClinicLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#eef4f5] px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_60px_-36px_rgba(13,59,76,0.45)] ring-1 ring-foreground/10 lg:grid-cols-[1fr_1.1fr]">
        <aside className="hidden bg-brand p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <Logo light />
          <div>
            <p className="text-sm text-white/70">Unidade de saúde</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Painel da equipe</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">
              Agenda, pacientes, associados, financeiro e profissionais. A conta do aplicativo não entra aqui.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-white/80">
            <li>Agenda do dia e da semana</li>
            <li>Mensalidades dos associados</li>
            <li>Pagamentos do aplicativo</li>
          </ul>
        </aside>
        <div className="p-8">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight lg:mt-0">Entrar</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Acesso da equipe. A conta criada no aplicativo do paciente não abre esta área.
          </p>
          <div className="mt-6">
            <ClinicLoginForm />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Voltar ao início</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
