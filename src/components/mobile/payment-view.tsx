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
      <Button asChild className="mt-5 h-12"><Link href="/mobile">Abrir atendimentos</Link></Button>
    </div>
  )
}
