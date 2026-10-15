"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useDemoStore } from "@/lib/store"

const STEPS = [
  { title: "Abrir o dashboard", text: "Mostre consultas de hoje, receita e ocupação. Troque o período para os números se atualizarem.", href: "/desktop", label: "Abrir painel" },
  { title: "Agenda e financeiro", text: "Percorra a semana, abra uma consulta e depois o financeiro com a marca de simulação.", href: "/desktop/agenda", label: "Abrir agenda" },
  { title: "Aplicativo do paciente", text: "A paciente de demonstração é Helena Martins, em Teresina.", href: "/mobile", label: "Abrir app" },
  { title: "Buscar profissional", text: "Filtre por especialidade, presencial ou teleconsulta demonstrativa.", href: "/mobile/buscar", label: "Buscar" },
  { title: "Escolher a consulta", text: "Abra um perfil, escolha serviço, data e um horário que ainda esteja livre.", href: "/mobile/agendamento", label: "Agendar" },
  { title: "Simular o pagamento", text: "Use o QR ilustrativo ou o cartão 0000 0000 0000 0000, validade 12/30 e CVV 000.", href: "/mobile/pagamento", label: "Pagamento" },
  { title: "Voltar à clínica", text: "A consulta nova aparece na agenda e o valor recebido entra no financeiro.", href: "/desktop/agenda", label: "Ver na agenda" },
  { title: "Prontuário", text: "Abra um prontuário fictício, edite a anotação e salve neste navegador.", href: "/desktop/prontuarios", label: "Abrir prontuário" },
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
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Oito passos para a apresentação</h1>
        <p className="mt-3 text-muted-foreground">
          Use duas janelas do mesmo navegador, neste computador. A sincronização acontece pelo armazenamento local e não funciona entre celulares ou computadores diferentes.
        </p>
        <ol className="mt-8 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 ring-1 ring-foreground/10">
              <div>
                <p className="text-xs text-teal">Passo {index + 1}</p>
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">{step.text}</p>
              </div>
              <Button asChild variant="outline"><Link href={step.href}>{step.label}</Link></Button>
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
