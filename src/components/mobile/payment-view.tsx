"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function PaymentView() {
  return (
    <div className="px-5 pt-8">
      <p className="section-kicker">Pagamento</p>
      <h1 className="mt-2 text-2xl font-semibold">Pague pelo carrinho</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Escolha o atendimento e o horário. No fim do carrinho, o sistema gera um Pix real da Asaas para cada atendimento.
      </p>
      <div className="mt-5 space-y-2">
        <Button asChild className="h-12 w-full"><Link href="/mobile">Abrir atendimentos</Link></Button>
        <Button asChild variant="outline" className="h-12 w-full"><Link href="/mobile/consultas">Minhas consultas</Link></Button>
      </div>
    </div>
  )
}
