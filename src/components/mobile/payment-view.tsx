"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, BadgeCheck, CreditCard, Loader2, QrCode, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { associateQuote, findActiveAssociate } from "@/lib/associate-rules"
import { minimumAsaasCharge, minimumAsaasChargeMessage } from "@/lib/asaas/minimums"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import { SPECIALTY_LABEL } from "@/lib/types"

type BillingType = "PIX" | "CREDIT_CARD"
type AssociateAnswer = "yes" | "no"
type ChargeResult = {
  value: number
  billingType: BillingType
  invoiceUrl: string | null
  pix: { payload: string | null; encodedImage: string | null } | null
  pixUnavailable?: boolean
}

export function PaymentView() {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const booking = useDemoStore((state) => state.booking)
  const clearBooking = useDemoStore((state) => state.clearBooking)
  const sessionId = useDemoStore((state) => state.mobileSessionPatientId)
  const associates = useDemoStore((state) => state.associates)
  const rules = useDemoStore((state) => state.associateRules)

  const [billingType, setBillingType] = useState<BillingType>("PIX")
  const [associateAnswer, setAssociateAnswer] = useState<AssociateAnswer | null>(null)
  const [processing, setProcessing] = useState(false)
  const [charges, setCharges] = useState<ChargeResult[] | null>(null)

  const patient = data.patients.find((item) => item.id === sessionId)
  const professional = data.professionals.find((item) => item.id === booking.professionalId)
  const service = professional?.services.find((item) => item.id === booking.serviceId)
  const hasBooking = Boolean(professional && service && booking.date && booking.time)

  const associate = patient ? findActiveAssociate(associates, patient.cpf) : null
  const quote = service ? associateQuote(service.price, rules, associate) : null
  const hasDiscount = Boolean(quote?.benefit && quote.benefit.discountPercent > 0)
  const finalPrice = quote && associateAnswer === "yes" && hasDiscount
    ? quote.amount
    : (service?.price ?? 0)

  const belowMinimum = Boolean(billingType && finalPrice < minimumAsaasCharge(billingType))

  async function handlePay() {
    if (!sessionId) {
      toast.error("Entre na sua conta para concluir o pagamento.")
      router.push("/mobile")
      return
    }
    if (!hasBooking || !booking.professionalId || !booking.serviceId || !booking.date || !booking.time) {
      toast.error("Dados do agendamento incompletos.")
      return
    }
    if (!associateAnswer) {
      toast.error("Informe se você é associado.")
      return
    }
    if (associateAnswer === "yes" && !associate) {
      toast.error("Não encontramos uma associação ativa para este CPF.")
      return
    }
    setProcessing(true)
    try {
      const response = await fetch("/api/payments/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: [
            {
              professionalId: booking.professionalId,
              serviceId: booking.serviceId,
              date: booking.date,
              time: booking.time,
            },
          ],
          billingType,
          associateAnswer,
        }),
      })
      const body = (await response.json()) as { error?: string; charges?: ChargeResult[] }
      if (!response.ok || !body.charges) {
        toast.error(body.error || "Não foi possível gerar a cobrança.")
        return
      }
      setCharges(body.charges)
      clearBooking()
      toast.success("Cobrança gerada com sucesso.")
    } catch {
      toast.error("Não foi possível conectar com o serviço de pagamento. Tente novamente.")
    } finally {
      setProcessing(false)
    }
  }

  // If already charged: show payment details & QR
  if (charges && charges.length > 0) {
    return (
      <div className="px-4 pt-6 pb-8 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal">Pagamento</p>
          <h1 className="mt-1 text-2xl font-semibold">Cobrança gerada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Efetue o pagamento para confirmar seu agendamento.
          </p>
        </div>

        {charges.map((charge, index) => (
          <section key={index} className="surface-card p-4 space-y-3">
            <p className="font-medium">
              {charge.billingType === "PIX" ? "Pix" : "Cartão de Crédito"} · {formatMoney(charge.value)}
            </p>
            {charge.pix?.encodedImage ? (
              <img
                className="mx-auto size-52 rounded-xl border p-2"
                src={`data:image/png;base64,${charge.pix.encodedImage}`}
                alt="QR Code Pix para pagamento"
              />
            ) : null}
            {charge.pix?.payload ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  void navigator.clipboard.writeText(charge.pix?.payload || "").then(() =>
                    toast.success("Código Pix copiado!"),
                  )
                }
              >
                Copiar código Pix
              </Button>
            ) : null}
            {charge.pixUnavailable ? (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                O QR Code Pix não pôde ser gerado agora. Utilize o link direto da Asaas abaixo.
              </p>
            ) : null}
            {charge.invoiceUrl ? (
              <Button asChild className="w-full">
                <a href={charge.invoiceUrl} target="_blank" rel="noreferrer">
                  {charge.billingType === "CREDIT_CARD" ? "Pagar com cartão na Asaas" : "Abrir cobrança na Asaas"}
                </a>
              </Button>
            ) : null}
          </section>
        ))}

        <div className="space-y-2 pt-2">
          <Button asChild className="h-12 w-full bg-teal text-white hover:bg-teal/90">
            <Link href="/mobile/consultas">Ir para Minhas Consultas</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 w-full">
            <Link href="/mobile">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    )
  }

  // If no booking was created
  if (!hasBooking) {
    return (
      <div className="px-5 pt-8">
        <p className="section-kicker">Pagamento</p>
        <h1 className="mt-2 text-2xl font-semibold">Nenhuma consulta selecionada</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Escolha um profissional e selecione um horário para agendar e gerar a cobrança Pix ou cartão.
        </p>
        <div className="mt-6 space-y-3">
          <Button asChild className="h-12 w-full">
            <Link href="/mobile/buscar">
              <Search className="size-4 mr-2" /> Buscar profissionais
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 w-full">
            <Link href="/mobile">Abrir catálogo</Link>
          </Button>
          <Button asChild variant="ghost" className="h-12 w-full">
            <Link href="/mobile/consultas">Minhas consultas</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Active booking checkout
  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/mobile/agendamento">
            <ArrowLeft className="size-4 mr-1" /> Voltar ao agendamento
          </Link>
        </Button>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-teal">Etapa final</p>
        <h1 className="mt-1 text-2xl font-semibold">Pagamento da consulta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confira o resumo do seu agendamento e escolha a forma de pagamento.
        </p>
      </div>

      {/* Appointment Summary */}
      <section className="surface-card p-4 space-y-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-base">{professional?.name}</p>
            <p className="text-xs text-muted-foreground">
              {professional?.specialty ? SPECIALTY_LABEL[professional.specialty] : "Especialista"} · {professional?.location || "Unidade"}
            </p>
          </div>
          <span className="shrink-0 font-semibold text-base">
            {formatMoney(finalPrice)}
          </span>
        </div>
        <div className="pt-2 border-t text-muted-foreground">
          <p><strong className="text-foreground">{service?.name}</strong> ({service?.durationMin} min)</p>
          <p>{booking.date ? formatDate(`${booking.date}T12:00:00`, "EEEE, d 'de' MMMM") : ""} às {booking.time}</p>
        </div>
        {quote?.benefit && quote.benefit.discountPercent > 0 && associateAnswer === "yes" ? (
          <p className="text-xs text-emerald-700 font-medium pt-1">
            Desconto de associado aplicado: {quote.benefit.discountPercent}% OFF
          </p>
        ) : null}
      </section>

      {/* Associate question */}
      <section className="surface-card p-4 space-y-3">
        <h2 className="font-semibold text-sm">Você é associado?</h2>
        <p className="text-xs text-muted-foreground">
          Associados ativos ganham desconto na consulta. A verificação é feita pelo seu CPF.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={associateAnswer === "yes" ? "default" : "outline"}
            onClick={() => setAssociateAnswer("yes")}
          >
            Sim, sou associado
          </Button>
          <Button
            type="button"
            variant={associateAnswer === "no" ? "default" : "outline"}
            onClick={() => setAssociateAnswer("no")}
          >
            Não sou associado
          </Button>
        </div>
        {associateAnswer === "yes" && associate ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl font-medium">
            <BadgeCheck className="size-4 shrink-0" /> Associação confirmada para seu CPF.
          </p>
        ) : null}
        {associateAnswer === "yes" && !associate ? (
          <div className="bg-amber-50 p-3 rounded-xl text-xs text-amber-900 space-y-2">
            <p>Nenhuma associação ativa foi encontrada para o CPF desta conta.</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="font-medium underline"
                onClick={() => setAssociateAnswer("no")}
              >
                Continuar sem desconto
              </button>
              <Link href="/mobile/perfil" className="font-medium underline">
                Ver planos
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {/* Payment method */}
      {associateAnswer ? (
        <section className="surface-card p-4 space-y-3">
          <h2 className="font-semibold text-sm">Forma de pagamento</h2>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setBillingType("PIX")}
              className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors ${
                billingType === "PIX" ? "bg-[#e8f4f2] ring-teal" : "bg-white ring-border"
              }`}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#dff2ee] text-teal">
                <QrCode className="size-5" />
              </span>
              <div>
                <span className="block font-medium text-sm">Pix</span>
                <span className="block text-xs text-muted-foreground">QR Code e Copia e Cola instantâneo</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBillingType("CREDIT_CARD")}
              className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors ${
                billingType === "CREDIT_CARD" ? "bg-[#e9eef8] ring-[#365f8b]" : "bg-white ring-border"
              }`}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#e9eef8] text-[#365f8b]">
                <CreditCard className="size-5" />
              </span>
              <div>
                <span className="block font-medium text-sm">Cartão de Crédito</span>
                <span className="block text-xs text-muted-foreground">Página protegida da Asaas</span>
              </div>
            </button>
          </div>

          {belowMinimum ? (
            <p className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl">
              {minimumAsaasChargeMessage(billingType)}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full h-12 mt-2"
            disabled={processing || belowMinimum || (associateAnswer === "yes" && !associate)}
            onClick={() => void handlePay()}
          >
            {processing ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            {billingType === "PIX" ? `Gerar Pix · ${formatMoney(finalPrice)}` : `Pagar com Cartão · ${formatMoney(finalPrice)}`}
          </Button>
        </section>
      ) : null}
    </div>
  )
}
