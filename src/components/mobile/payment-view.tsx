"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CreditCard,
  Loader2,
  QrCode,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { FlowSteps } from "@/components/shared/flow-steps"
import { AssociateSubscriptionModal } from "@/components/mobile/associate-subscription"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { calculateAssociateQuote } from "@/lib/associate-rules"
import { minimumAsaasCharge, minimumAsaasChargeMessage } from "@/lib/asaas/minimums"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import { type Associate, type AssociateRules, SPECIALTY_LABEL } from "@/lib/types"

type BillingType = "PIX" | "CREDIT_CARD" | "BOLETO"
type AssociateAnswer = "yes" | "no"
type ChargeResult = {
  value: number
  billingType: BillingType
  invoiceUrl: string | null
  pix: { payload: string | null; encodedImage: string | null } | null
  pixUnavailable?: boolean
  bankSlipUrl: string | null
  identificationField: string | null
}

type ServerMembership = {
  active: boolean
  status: "active" | "overdue" | "cancelled" | "inactive" | "none"
  overdueMonths: number
  pendingAmount: number
  rules: AssociateRules
}

export function PaymentView() {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const booking = useDemoStore((state) => state.booking)
  const clearBooking = useDemoStore((state) => state.clearBooking)
  const sessionId = useDemoStore((state) => state.mobileSessionPatientId)
  const rules = useDemoStore((state) => state.associateRules)

  const [billingType, setBillingType] = useState<BillingType>("PIX")
  const [associateAnswer, setAssociateAnswer] = useState<AssociateAnswer | null>(null)
  const [processing, setProcessing] = useState(false)
  const [charges, setCharges] = useState<ChargeResult[] | null>(null)

  // Server-verified associate state (eliminates false positives from useDemoStore.associates)
  const [membership, setMembership] = useState<ServerMembership | null>(null)
  const [loadingMembership, setLoadingMembership] = useState(true)
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)
  const [settleAssociateFee, setSettleAssociateFee] = useState<boolean>(true)

  const loadMembership = () => {
    fetch("/api/payments/subscription")
      .then((res) => res.json())
      .then((body) => {
        if (body && !body.error && body.rules) {
          setMembership({
            active: Boolean(body.active),
            status: body.status || (body.active ? "active" : "none"),
            overdueMonths: Number(body.overdueMonths) || 0,
            pendingAmount: Number(body.pendingAmount) || 0,
            rules: body.rules,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMembership(false))
  }

  useEffect(() => {
    loadMembership()
  }, [])

  const patient = data.patients.find((item) => item.id === sessionId)
  const professional = data.professionals.find((item) => item.id === booking.professionalId)
  const service = professional?.services.find((item) => item.id === booking.serviceId)
  const hasBooking = Boolean(professional && service && booking.date && booking.time)

  const effectiveRules: AssociateRules = membership?.rules ?? rules

  const associateStub: Associate | null =
    membership && membership.status !== "none"
      ? {
          id: "server",
          name: patient?.name || "",
          cpf: patient?.cpf || "",
          phone: patient?.phone || "",
          email: patient?.email || "",
          status: membership.status,
          overdueMonths: membership.overdueMonths,
          createdAt: new Date().toISOString(),
        }
      : null

  const quote = service
    ? calculateAssociateQuote({
        listPrice: service.price,
        rules: effectiveRules,
        associate: associateStub,
        settleOverdue: settleAssociateFee,
      })
    : null

  let finalPrice = service?.price ?? 0
  if (associateAnswer === "yes" && quote) {
    if (membership?.status === "active") {
      finalPrice = quote.consultationPrice
    } else if (membership?.status === "overdue") {
      finalPrice = settleAssociateFee ? quote.totalAmount : quote.consultationPrice
    }
  }

  const potentialSavings =
    quote?.potentialSavings ??
    Math.round(((service?.price ?? 0) * effectiveRules.consultationDiscountPercent) / 100)

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
    if (
      associateAnswer === "yes" &&
      (!membership || membership.status === "none" || membership.status === "cancelled")
    ) {
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
          settleAssociateFee:
            associateAnswer === "yes" && membership?.status === "overdue"
              ? settleAssociateFee
              : undefined,
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
          <FlowSteps steps={["Agendamento", "Pagamento", "Confirmação"]} current={2} />
          <div className="mt-4" />
          <p className="text-xs font-medium uppercase tracking-wide text-teal">Pagamento</p>
          <h1 className="mt-1 text-2xl font-semibold">Cobrança gerada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Efetue o pagamento para confirmar seu agendamento.
          </p>
        </div>

        {charges.map((charge, index) => (
          <section key={index} className="surface-card p-4 space-y-3">
            <p className="font-medium">
              {charge.billingType === "PIX" ? "Pix" : charge.billingType === "BOLETO" ? "Boleto" : "Cartão de Crédito"} · {formatMoney(charge.value)}
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
            {charge.billingType === "BOLETO" ? (
              <>
                {charge.identificationField ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Linha digitável / código de barras</p>
                    <Input readOnly value={charge.identificationField} className="font-mono text-xs" aria-label="Linha digitável do boleto" />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => void navigator.clipboard.writeText(charge.identificationField || "").then(() => toast.success("Linha digitável copiada!"))}
                    >
                      Copiar linha digitável
                    </Button>
                  </div>
                ) : null}
                <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                  O boleto pode levar até 3 dias úteis para compensar. A consulta continuará pendente até a confirmação.
                </p>
              </>
            ) : null}
            {charge.invoiceUrl ? (
              <Button asChild className="w-full">
                <a href={charge.invoiceUrl} target="_blank" rel="noreferrer">
                  {charge.billingType === "CREDIT_CARD" ? "Pagar com cartão na Asaas" : charge.billingType === "BOLETO" ? "Abrir boleto na Asaas" : "Abrir cobrança na Asaas"}
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
        <FlowSteps steps={["Agendamento", "Pagamento", "Confirmação"]} current={1} />
        <div className="mt-4" />
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
              {professional?.specialty ? SPECIALTY_LABEL[professional.specialty] : "Especialista"} ·{" "}
              {professional?.location || "Unidade"}
            </p>
          </div>
          <span className="shrink-0 font-semibold text-base">
            {formatMoney(finalPrice)}
          </span>
        </div>
        <div className="pt-2 border-t text-muted-foreground">
          <p>
            <strong className="text-foreground">{service?.name}</strong> ({service?.durationMin} min)
          </p>
          <p>
            {booking.date ? formatDate(`${booking.date}T12:00:00`, "EEEE, d 'de' MMMM") : ""} às {booking.time}
          </p>
        </div>

        {/* Pricing breakdown for active associate discount */}
        {associateAnswer === "yes" && membership?.status === "active" && quote?.discountApplied ? (
          <p className="text-xs text-emerald-700 font-medium pt-1">
            Desconto de associado aplicado: {effectiveRules.consultationDiscountPercent}% OFF ({formatMoney(quote.savings)} de economia)
          </p>
        ) : null}

        {/* Pricing breakdown for overdue settlement */}
        {associateAnswer === "yes" && membership?.status === "overdue" && settleAssociateFee && quote ? (
          <div className="pt-2 border-t text-xs space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Consulta com {effectiveRules.consultationDiscountPercent}% OFF:</span>
              <span className="font-medium text-foreground">{formatMoney(quote.consultationPrice)}</span>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>Quitação de pendência ({membership.overdueMonths}x mensalidade):</span>
              <span className="font-medium">+{formatMoney(quote.overdueSettlementFee)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground pt-1 border-t">
              <span>Total a pagar:</span>
              <span>{formatMoney(finalPrice)}</span>
            </div>
          </div>
        ) : null}
      </section>

      {/* Associate question */}
      <section className="surface-card p-4 space-y-3">
        <h2 className="font-semibold text-sm">Você é associado?</h2>
        <p className="text-xs text-muted-foreground">
          Associados ativos ganham desconto na consulta. A verificação é feita automaticamente pelo seu CPF.
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

        {/* Non-Associate High-Converting Savings CTA Card */}
        {associateAnswer === "no" ? (
          <div className="rounded-2xl border border-teal/20 bg-teal/5 p-4 mt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-teal text-sm">
                  Economize {formatMoney(potentialSavings)} nesta consulta!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Associe-se por apenas {formatMoney(effectiveRules.fee)}/mês e ganhe descontos em todas as consultas e exames.
                </p>
              </div>
              <Button
                size="sm"
                type="button"
                className="shrink-0 bg-teal text-white hover:bg-teal/90"
                onClick={() => setShowSubscribeModal(true)}
              >
                Quero me associar
              </Button>
            </div>
          </div>
        ) : null}

        {/* Associate: Checking */}
        {associateAnswer === "yes" && loadingMembership ? (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-teal" /> Verificando dados da associação...
          </div>
        ) : null}

        {/* Associate: Active status */}
        {associateAnswer === "yes" && !loadingMembership && membership?.status === "active" ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl font-medium">
            <BadgeCheck className="size-4 shrink-0" /> Associação confirmada para seu CPF. Desconto aplicado!
          </p>
        ) : null}

        {/* Associate: Overdue status decision flow */}
        {associateAnswer === "yes" && !loadingMembership && membership?.status === "overdue" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-amber-900">
                  Mensalidade em atraso ({membership.overdueMonths} {membership.overdueMonths === 1 ? "mês" : "meses"})
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Para utilizar o desconto de associado nesta consulta, você pode quitar a mensalidade pendente agora:
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {/* Option A: Settle overdue + discounted consultation */}
              <button
                type="button"
                onClick={() => setSettleAssociateFee(true)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left text-xs transition-colors ${
                  settleAssociateFee
                    ? "border-teal bg-white ring-2 ring-teal"
                    : "border-border bg-white/70 text-muted-foreground hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="settleOverdue"
                  checked={settleAssociateFee}
                  onChange={() => setSettleAssociateFee(true)}
                  className="mt-0.5 text-teal focus:ring-teal"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Quitar pendência ({formatMoney(membership.pendingAmount)}) + Consulta com desconto
                    </span>
                    <span className="text-[10px] bg-teal/10 text-teal px-1.5 py-0.5 rounded font-medium ml-1">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Total: {formatMoney((quote?.consultationPrice ?? 0) + membership.pendingAmount)} (consulta sai por {formatMoney(quote?.consultationPrice ?? 0)} com {effectiveRules.consultationDiscountPercent}% OFF)
                  </p>
                </div>
              </button>

              {/* Option B: Pay full price without settling now */}
              <button
                type="button"
                onClick={() => setSettleAssociateFee(false)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left text-xs transition-colors ${
                  !settleAssociateFee
                    ? "border-teal bg-white ring-2 ring-teal"
                    : "border-border bg-white/70 text-muted-foreground hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="settleOverdue"
                  checked={!settleAssociateFee}
                  onChange={() => setSettleAssociateFee(false)}
                  className="mt-0.5 text-teal focus:ring-teal"
                />
                <div className="flex-1">
                  <span className="font-semibold text-foreground">
                    Pagar consulta valor normal ({formatMoney(service?.price ?? 0)}) sem quitar agora
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Você não recebe o desconto nesta consulta e a pendência permanecerá em aberto.
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : null}

        {/* Associate: None or Cancelled status */}
        {associateAnswer === "yes" &&
        !loadingMembership &&
        (!membership || membership.status === "none" || membership.status === "cancelled") ? (
          <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Nenhuma associação ativa encontrada para o seu CPF.</p>
                <p className="text-amber-800 mt-0.5">
                  {membership?.status === "cancelled"
                    ? "Sua associação anterior foi cancelada por inadimplência. Reative agora para ter desconto!"
                    : "Deseja se associar agora e garantir desconto nesta e nas próximas consultas?"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs bg-teal hover:bg-teal/90 text-white"
                onClick={() => setShowSubscribeModal(true)}
              >
                Associar agora
              </Button>
              <button
                type="button"
                className="font-medium text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                onClick={() => setAssociateAnswer("no")}
              >
                Continuar sem desconto
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Payment method selector */}
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
              onClick={() => setBillingType("BOLETO")}
              className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors ${
                billingType === "BOLETO" ? "bg-amber-50 ring-amber-500" : "bg-white ring-border"
              }`}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
                <Banknote className="size-5" />
              </span>
              <div>
                <span className="block font-medium text-sm">Boleto</span>
                <span className="block text-xs text-muted-foreground">Linha digitável e compensação em até 3 dias úteis</span>
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

          {billingType === "BOLETO" ? (
            <p className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl">
              O boleto pode levar até 3 dias úteis para compensar. A consulta continuará pendente até a confirmação.
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full h-12 mt-2"
            disabled={
              processing ||
              belowMinimum ||
              loadingMembership ||
              (associateAnswer === "yes" &&
                (!membership || membership.status === "none" || membership.status === "cancelled"))
            }
            onClick={() => void handlePay()}
          >
            {processing ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            {billingType === "PIX"
              ? `Gerar Pix · ${formatMoney(finalPrice)}`
              : billingType === "BOLETO"
                ? `Gerar boleto · ${formatMoney(finalPrice)}`
                : `Pagar com Cartão · ${formatMoney(finalPrice)}`}
          </Button>
        </section>
      ) : null}

      {/* Subscription Modal */}
      <AssociateSubscriptionModal
        open={showSubscribeModal}
        onOpenChange={setShowSubscribeModal}
        rules={effectiveRules}
        onSubscribed={() => {
          loadMembership()
          setAssociateAnswer("yes")
        }}
      />
    </div>
  )
}
