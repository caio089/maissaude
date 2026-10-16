"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AppointmentConfirmation } from "@/components/mobile/appointment-confirmation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { PaymentMethod } from "@/lib/types"
import { DEMO_CARD_HINT, hasErrors, validateDemoCard } from "@/lib/validation"

export function PaymentView() {
  const data = useDemoStore((state) => state.data)
  const booking = useDemoStore((state) => state.booking)
  const lastCheckout = useDemoStore((state) => state.lastCheckout)
  const simulateCheckout = useDemoStore((state) => state.simulateCheckout)
  const clearCheckout = useDemoStore((state) => state.clearCheckout)
  const [method, setMethod] = useState<PaymentMethod>("pix")
  const [processing, setProcessing] = useState<PaymentMethod | "wait" | null>(null)
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof card, string>>>({})
  const professional = data.professionals.find((item) => item.id === booking.professionalId)
  const service = professional?.services.find((item) => item.id === booking.serviceId)
  const ready = Boolean(professional && service && booking.date && booking.time && !booking.rescheduleAppointmentId)

  async function pay(outcome: "approved" | "declined") {
    if (method === "card") {
      const nextErrors = validateDemoCard(card)
      setErrors(nextErrors)
      if (hasErrors(nextErrors)) return
    }
    setProcessing("wait")
    await new Promise((resolve) => window.setTimeout(resolve, 1200))
    const result = simulateCheckout(method, outcome)
    setCard({ number: "", name: "", expiry: "", cvv: "" })
    setProcessing(null)
    if (result.ok) toast.success("Pagamento simulado aprovado.")
    else toast.error(result.message)
  }

  if (lastCheckout?.outcome === "approved" && !booking.professionalId) {
    return <AppointmentConfirmation onAnother={clearCheckout} />
  }

  if (!ready || !professional || !service || !booking.date || !booking.time) {
    return (
      <div className="px-5 pt-8">
        <h1 className="text-2xl font-semibold">Pagamento</h1>
        <p className="mt-2 text-sm text-muted-foreground">Escolha o horário antes de simular o pagamento.</p>
        <Button asChild className="mt-4"><Link href="/mobile/agendamento">Voltar ao agendamento</Link></Button>
      </div>
    )
  }

  return (
    <div className="px-5 pt-5 pb-6">
      <h1 className="text-2xl font-semibold">Pagamento simulado</h1>
      <p className="mt-1 text-sm text-muted-foreground">Nenhum dado de cartão é salvo e nenhuma cobrança real é criada.</p>
      <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-border">
        <p className="text-sm text-muted-foreground">{professional.name}</p>
        <p className="font-medium">{service.name}</p>
        <p className="text-sm">{formatDate(`${booking.date}T12:00:00`, "d 'de' MMMM")} às {booking.time}</p>
        <p className="mt-2 text-2xl font-semibold">{formatMoney(service.price)}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMethod("pix")} className={`rounded-2xl py-3 text-sm ${method === "pix" ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>Pix</button>
        <button type="button" onClick={() => setMethod("card")} className={`rounded-2xl py-3 text-sm ${method === "card" ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>Cartão</button>
      </div>
      {method === "pix" ? <DemoQr /> : (
        <div className="mt-4 space-y-3 rounded-3xl bg-white p-4 ring-1 ring-border">
          <Field label="Nome fictício" error={errors.name}><Input className="h-10" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} /></Field>
          <Field label="Número fictício" error={errors.number} hint={`Use ${DEMO_CARD_HINT}`}><Input className="h-10" inputMode="numeric" value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Validade" error={errors.expiry}><Input className="h-10" placeholder="12/30" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: event.target.value })} /></Field>
            <Field label="CVV" error={errors.cvv}><Input className="h-10" placeholder="000" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} /></Field>
          </div>
        </div>
      )}
      {lastCheckout?.outcome === "declined" ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">A simulação recusou o pagamento {lastCheckout.reference}. O horário não foi reservado.</p> : null}
      <div className="mt-5 space-y-2">
        <Button type="button" className="h-12 w-full" disabled={processing !== null} onClick={() => void pay("approved")}>
          {processing ? <Loader2 className="animate-spin" /> : null} Simular pagamento aprovado
        </Button>
        <Button type="button" variant="outline" className="h-12 w-full" disabled={processing !== null} onClick={() => void pay("declined")}>
          Simular pagamento recusado
        </Button>
      </div>
    </div>
  )
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      {label}
      <div className="mt-1">{children}</div>
      {error ? <span className="mt-1 block text-xs text-destructive">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

function DemoQr() {
  const cells = Array.from({ length: 15 }, (_, row) =>
    Array.from({ length: 15 }, (_, column) => (row < 5 && column < 5) || (row + column) % 3 === 0),
  )
  return (
    <div className="relative mt-4 grid place-items-center rounded-3xl bg-white p-6 ring-1 ring-border">
      <svg viewBox="0 0 15 15" className="h-40 w-40" role="img" aria-label="Imagem decorativa de QR Code, sem cobrança">
        {cells.flatMap((row, rowIndex) => row.map((filled, columnIndex) => (
          filled ? <rect key={`${rowIndex}-${columnIndex}`} x={columnIndex} y={rowIndex} width="1" height="1" fill="#0d3b4c" /> : null
        )))}
      </svg>
      <p className="pointer-events-none absolute text-sm font-semibold tracking-[0.25em] text-brand/70">DEMONSTRAÇÃO</p>
      <p className="mt-3 text-center text-xs text-muted-foreground">QR ilustrativo. Não contém chave Pix nem código de cobrança.</p>
    </div>
  )
}
