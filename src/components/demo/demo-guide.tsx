"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useDemoStore } from "@/lib/store"

const STEPS = [
  { title: "Entrar no painel", text: "Abra a rota /desktop/entrar e entre com o acesso da equipe. A conta do paciente não passa." },
  { title: "Agenda e financeiro", text: "No painel, percorra a semana, abra uma consulta e depois o financeiro com a marca de simulação. Rotas: /desktop/agenda e /desktop/financeiro." },
  { title: "Aplicativo do paciente", text: "Em outra janela, abra a rota /mobile e crie a conta com nome, CPF fictício começando em 900 e uma senha de demonstração." },
  { title: "Especialidade e médico", text: "No aplicativo, escolha a especialidade e, em seguida, o profissional." },
  { title: "Dia, hora e pagamento", text: "Escolha um horário livre e simule o pagamento aprovado. Use o cartão 0000 0000 0000 0000, validade 12/30 e CVV 000 se for cartão." },
  { title: "WhatsApp e painel", text: "A tela final abre o WhatsApp com a confirmação. A consulta e o pagamento já estão na agenda e no financeiro do painel." },
]

export function DemoGuide() {
  const resetDemo = useDemoStore((state) => state.resetDemo)
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/"><Logo /></Link>
        <Button type="button" variant="outline" onClick={() => setConfirm(true)}>Reiniciar demonstração</Button>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <p className="text-sm font-medium text-teal">Roteiro comercial</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Seis passos para a apresentação</h1>
        <p className="mt-3 text-muted-foreground">
          Use duas janelas do mesmo navegador, neste computador. A sincronização acontece pelo armazenamento local e não funciona entre celulares ou computadores diferentes.
        </p>
        <ol className="mt-8 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-3xl bg-white p-5 ring-1 ring-foreground/10">
              <p className="text-xs text-teal">Passo {index + 1}</p>
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </main>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Restaurar o roteiro inicial?"
        description="Isso apaga agendamentos e pagamentos criados durante a apresentação neste navegador."
        confirmLabel="Restaurar"
        destructive
        onConfirm={() => {
          resetDemo()
          setConfirm(false)
          toast.success("Demonstração restaurada para o dia de hoje.")
        }}
      />
    </div>
  )
}
