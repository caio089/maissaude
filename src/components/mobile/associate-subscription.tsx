"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { FlowSteps } from "@/components/shared/flow-steps"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { AssociateRules } from "@/lib/types"

export type AssociateBillingMethod = "PIX" | "CREDIT_CARD" | "BOLETO"

export type AssociateSubscriptionChargeResult = {
  associateId?: string
  value?: number
  billingType: AssociateBillingMethod
  paymentUrl?: string | null
  invoiceUrl?: string | null
  pix?: { payload: string | null; encodedImage: string | null } | null
  bankSlipUrl?: string | null
  bankSlipBarcode?: string | null
}

export function AssociatePitch({
  title,
  lead,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onBack,
  pending = false,
  stepsCurrent,
}: {
  title: string
  lead: string
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  onBack?: () => void
  pending?: boolean
  stepsCurrent?: number
}) {
  const rules = useDemoStore((state) => state.associateRules)

  return (
    <div className="px-4 pt-6 pb-8">
      {onBack ? (
        <button type="button" onClick={onBack} className="text-sm text-teal">
          Voltar
        </button>
      ) : null}
      {typeof stepsCurrent === "number" ? (
        <div className="mt-3">
          <FlowSteps steps={["Seus dados", "Associação"]} current={stepsCurrent} />
        </div>
      ) : null}
      <p className="section-kicker mt-4">Assinatura</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{lead}</p>
      <AssociateBenefits rules={rules} />
      <Button type="button" className="mt-5 h-12 w-full" disabled={pending} onClick={onPrimary}>
        {primaryLabel}
      </Button>
      {secondaryLabel && onSecondary ? (
        <button
          type="button"
          className="mt-3 w-full text-sm text-teal"
          disabled={pending}
          onClick={onSecondary}
        >
          {secondaryLabel}
        </button>
      ) : null}
    </div>
  )
}

export function AssociatePayForm({
  onBack,
  onConfirm,
  onSuccess,
  rules,
  className = "px-4 pt-6 pb-8",
}: {
  onBack: () => void
  onConfirm?: () => void | Promise<void>
  onSuccess?: (result: AssociateSubscriptionChargeResult) => void
  rules: AssociateRules
  className?: string
}) {
  const [billingType, setBillingType] = useState<AssociateBillingMethod>("CREDIT_CARD")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<AssociateSubscriptionChargeResult | null>(null)
  const confirmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    confirmRef.current?.scrollIntoView({ block: "center" })
  }, [])

  async function handleSubmit() {
    setError("")
    setPending(true)
    try {
      if (onConfirm) {
        await onConfirm()
        setPending(false)
        return
      }

      const response = await fetch("/api/payments/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingType }),
      })
      const body = (await response.json()) as { error?: string } & AssociateSubscriptionChargeResult
      if (!response.ok || body.error) {
        setError(body.error || "Não foi possível gerar a assinatura.")
        return
      }

      setResult(body)
      toast.success(
        billingType === "PIX"
          ? "QR Code Pix gerado com sucesso!"
          : billingType === "BOLETO"
          ? "Boleto gerado com sucesso!"
          : "Página segura da Asaas gerada com sucesso!",
      )
      onSuccess?.(body)
    } catch {
      setError("Não foi possível conectar ao serviço de pagamentos.")
    } finally {
      setPending(false)
    }
  }

  // Display Generated Payment details
  if (result) {
    if (result.billingType === "PIX") {
      return (
        <div className={className}>
          <div className="surface-card p-5 space-y-4">
            <div className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#dff2ee] text-teal">
                <QrCode className="size-6" />
              </span>
              <h2 className="mt-3 text-lg font-semibold">Pix gerado com sucesso</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pague {formatMoney(result.value || rules.fee)} para ativar imediatamente seus benefícios.
              </p>
            </div>

            {result.pix?.encodedImage ? (
              <div className="flex justify-center p-3 bg-white rounded-2xl border">
                <img
                  className="size-48 rounded-xl"
                  src={`data:image/png;base64,${result.pix.encodedImage}`}
                  alt="QR Code Pix para pagamento da associação"
                />
              </div>
            ) : null}

            {result.pix?.payload ? (
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded-xl text-xs font-mono break-all line-clamp-3">
                  {result.pix.payload}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() =>
                    void navigator.clipboard.writeText(result.pix?.payload || "").then(() =>
                      toast.success("Código Pix copiado!"),
                    )
                  }
                >
                  <Copy className="size-4" /> Copiar código Pix
                </Button>
              </div>
            ) : null}

            {result.invoiceUrl ? (
              <Button asChild variant="outline" className="w-full">
                <a href={result.invoiceUrl} target="_blank" rel="noreferrer">
                  Visualizar fatura na Asaas <ExternalLink className="size-4 ml-1" />
                </a>
              </Button>
            ) : null}

            <p className="text-xs text-muted-foreground text-center">
              A associação é ativada instantaneamente após a confirmação do pagamento pelo Banco Central.
            </p>

            <Button type="button" className="w-full h-11" onClick={onBack}>
              Concluir
            </Button>
          </div>
        </div>
      )
    }

    if (result.billingType === "BOLETO") {
      return (
        <div className={className}>
          <div className="surface-card p-5 space-y-4">
            <div className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                <FileText className="size-6" />
              </span>
              <h2 className="mt-3 text-lg font-semibold">Boleto gerado com sucesso</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Valor de {formatMoney(result.value || rules.fee)}. O prazo de compensação bancária é de até 3 dias úteis.
              </p>
            </div>

            {result.bankSlipBarcode ? (
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded-xl text-xs font-mono break-all text-center">
                  {result.bankSlipBarcode}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() =>
                    void navigator.clipboard.writeText(result.bankSlipBarcode || "").then(() =>
                      toast.success("Linha digitável copiada!"),
                    )
                  }
                >
                  <Copy className="size-4" /> Copiar linha digitável
                </Button>
              </div>
            ) : null}

            {result.bankSlipUrl || result.invoiceUrl ? (
              <Button asChild className="w-full h-11">
                <a
                  href={result.bankSlipUrl || result.invoiceUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visualizar / Imprimir Boleto <ExternalLink className="size-4 ml-1" />
                </a>
              </Button>
            ) : null}

            <Button type="button" variant="outline" className="w-full" onClick={onBack}>
              Concluir
            </Button>
          </div>
        </div>
      )
    }

    // CREDIT_CARD result
    return (
      <div className={className}>
        <section className="surface-card p-5 space-y-4">
          <div className="text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e9eef8] text-[#365f8b]">
              <ShieldCheck className="size-6" />
            </span>
            <h2 className="mt-3 text-lg font-semibold">Página segura pronta</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Abra a Asaas, informe o cartão e conclua a assinatura mensal. A associação será ativada após a confirmação do pagamento.
            </p>
          </div>

          {result.paymentUrl ? (
            <Button asChild className="mt-2 h-12 w-full">
              <a href={result.paymentUrl} target="_blank" rel="noreferrer">
                Ir para a Asaas e cadastrar cartão <ExternalLink className="size-4 ml-1" />
              </a>
            </Button>
          ) : null}

          <button
            type="button"
            className="w-full text-sm text-teal text-center pt-2"
            onClick={() => setResult(null)}
          >
            Voltar aos detalhes
          </button>
        </section>
      </div>
    )
  }

  // Pre-payment Form with Pix, Card, Boleto selection
  return (
    <div className={className}>
      <button type="button" onClick={onBack} className="text-sm text-teal">
        Voltar
      </button>
      <p className="section-kicker mt-4">Plano de associado</p>
      <h1 className="mt-2 text-2xl font-semibold">Veja tudo antes de assinar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Mensalidade de {formatMoney(rules.fee)} por mês. Escolha como prefere pagar sua assinatura.
      </p>

      <AssociateBenefits rules={rules} />

      {/* Multichannel Payment Selector */}
      <div className="mt-5 space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Forma de pagamento da mensalidade
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setBillingType("CREDIT_CARD")}
            className={`p-3 rounded-2xl border text-center transition-all ${
              billingType === "CREDIT_CARD"
                ? "border-teal bg-[#e9eef8] ring-1 ring-[#365f8b] text-[#1b3d63]"
                : "border-border bg-white text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <CreditCard className="size-5 mx-auto mb-1" />
            <span className="block text-xs font-semibold">Cartão</span>
            <span className="block text-[10px] text-muted-foreground">Recorrente</span>
          </button>

          <button
            type="button"
            onClick={() => setBillingType("PIX")}
            className={`p-3 rounded-2xl border text-center transition-all ${
              billingType === "PIX"
                ? "border-teal bg-[#e8f4f2] ring-1 ring-teal text-teal-900"
                : "border-border bg-white text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <QrCode className="size-5 mx-auto mb-1" />
            <span className="block text-xs font-semibold">Pix</span>
            <span className="block text-[10px] text-muted-foreground">Instantâneo</span>
          </button>

          <button
            type="button"
            onClick={() => setBillingType("BOLETO")}
            className={`p-3 rounded-2xl border text-center transition-all ${
              billingType === "BOLETO"
                ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400 text-amber-900"
                : "border-border bg-white text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <FileText className="size-5 mx-auto mb-1" />
            <span className="block text-xs font-semibold">Boleto</span>
            <span className="block text-[10px] text-muted-foreground">Até 3 dias</span>
          </button>
        </div>
      </div>

      {billingType === "CREDIT_CARD" ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#e9eef8] p-4 text-sm text-[#365f8b]">
          <CreditCard className="mt-0.5 size-4 shrink-0" />
          A mensalidade não aceita Pix na modalidade de recorrência automática. Os dados do cartão ficam protegidos com a Asaas e não são armazenados neste aplicativo.
        </p>
      ) : null}

      {billingType === "PIX" ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#dff2ee] p-4 text-sm text-teal">
          <QrCode className="mt-0.5 size-4 shrink-0" />
          O código Pix e o QR Code são gerados instantaneamente. Seus benefícios são ativados logo após a confirmação bancária.
        </p>
      ) : null}

      {billingType === "BOLETO" ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 border border-amber-200">
          <FileText className="mt-0.5 size-4 shrink-0" />
          O boleto pode ser pago em qualquer banco ou aplicativo. A compensação ocorre em até 3 dias úteis.
        </p>
      ) : null}

      <section className="surface-card mt-4 p-4">
        <h2 className="font-semibold text-sm">Como funciona</h2>
        <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-medium text-teal">
              1
            </span>
            <span>Você revisa a mensalidade ({formatMoney(rules.fee)}) e todos os benefícios.</span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-medium text-teal">
              2
            </span>
            <span>
              {billingType === "CREDIT_CARD"
                ? "Abrimos a página segura da Asaas para você cadastrar o cartão com segurança."
                : billingType === "PIX"
                ? "Geramos o QR Code e o código Pix Copia e Cola para pagamento imediato."
                : "Geramos o boleto bancário com código de barras para pagamento."}
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-medium text-teal">
              3
            </span>
            <span>Os benefícios e descontos de associado são ativados assim que o pagamento for confirmado.</span>
          </li>
        </ol>
      </section>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div ref={confirmRef}>
        <Button
          type="button"
          className="mt-5 h-12 w-full"
          disabled={pending}
          onClick={() => void handleSubmit()}
        >
          {pending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
          {billingType === "CREDIT_CARD"
            ? "Continuar para o cartão"
            : billingType === "PIX"
            ? `Gerar Pix · ${formatMoney(rules.fee)}`
            : `Gerar Boleto · ${formatMoney(rules.fee)}`}
        </Button>
      </div>
    </div>
  )
}

export function AssociateSubscriptionModal({
  open,
  onOpenChange,
  rules,
  onSubscribed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rules: AssociateRules
  onSubscribed?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-4 sm:p-6 max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Plano de Associado CuidarSaúde</DialogTitle>
          <DialogDescription>
            Assine para obter descontos em consultas e exames na rede CuidarSaúde.
          </DialogDescription>
        </DialogHeader>
        <AssociatePayForm
          rules={rules}
          className="p-1"
          onBack={() => onOpenChange(false)}
          onSuccess={() => {
            onSubscribed?.()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

export function AssociateAccountPanel() {
  const patientId = useDemoStore((state) => state.mobileSessionPatientId)
  const patient = useDemoStore((state) => state.data.patients.find((item) => item.id === patientId))
  const localRules = useDemoStore((state) => state.associateRules)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState("")
  const [membership, setMembership] = useState<{
    active: boolean
    status: string
    overdueMonths: number
    pendingAmount: number
    rules: AssociateRules
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMembership = () => {
    fetch("/api/payments/subscription")
      .then(async (response) => {
        const body = (await response.json()) as {
          active?: boolean
          status?: string
          overdueMonths?: number
          pendingAmount?: number
          rules?: AssociateRules
          error?: string
        }
        if (response.ok && body && !body.error && body.rules) {
          setMembership({
            active: Boolean(body.active),
            status: body.status || (body.active ? "active" : "none"),
            overdueMonths: Number(body.overdueMonths) || 0,
            pendingAmount: Number(body.pendingAmount) || 0,
            rules: body.rules,
          })
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMembership()
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("associar") === "1") {
      queueMicrotask(() => setPaying(true))
    }
  }, [])

  if (!patient) return null
  const rules = membership?.rules ?? localRules
  // 100% derivado da API do servidor: remove uso de useDemoStore.associates
  const active = Boolean(membership?.active)
  const status = membership?.status || (membership ? "none" : loading ? "loading" : "none")

  if (paying && !active) {
    return (
      <div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        <AssociatePayForm
          rules={rules}
          onBack={() => setPaying(false)}
          onSuccess={() => {
            loadMembership()
          }}
        />
      </div>
    )
  }

  if (status === "active") {
    return (
      <section className="surface-card p-4">
        <div className="flex items-center gap-2 text-teal">
          <BadgeCheck className="size-5 shrink-0" />
          <p className="text-sm font-semibold">Assinatura ativa</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Mensalidade de {formatMoney(rules.fee)}. O desconto de {rules.consultationDiscountPercent}% entra nas consultas pagas pelo aplicativo.
        </p>
        <BenefitLines rules={rules} />
      </section>
    )
  }

  if (status === "overdue") {
    return (
      <section className="surface-card p-4 border border-amber-200 bg-amber-50/50">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="text-sm font-semibold">Mensalidade em atraso</p>
        </div>
        <p className="mt-1 text-sm text-amber-900">
          Você possui pendência de {formatMoney(membership?.pendingAmount || rules.fee)} ({membership?.overdueMonths || 1}{" "}
          {membership?.overdueMonths === 1 ? "mês" : "meses"} em atraso).
        </p>
        <p className="mt-1 text-xs text-amber-800">
          Regularize sua assinatura para garantir descontos exclusivos e manter seus benefícios ativos.
        </p>
        <BenefitLines rules={rules} />
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button
          type="button"
          className="mt-4 h-11 w-full bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => {
            setError("")
            setPaying(true)
          }}
        >
          Regularizar agora ({formatMoney(membership?.pendingAmount || rules.fee)})
        </Button>
      </section>
    )
  }

  if (status === "cancelled") {
    return (
      <section className="surface-card p-4 border border-rose-200 bg-rose-50/50">
        <div className="flex items-center gap-2 text-rose-700">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-semibold">Assinatura cancelada</p>
        </div>
        <p className="mt-1 text-sm text-rose-900">
          Sua assinatura anterior foi cancelada por inadimplência. Associe-se novamente para reativar todos os seus benefícios.
        </p>
        <BenefitLines rules={rules} />
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button
          type="button"
          className="mt-4 h-11 w-full"
          onClick={() => {
            setError("")
            setPaying(true)
          }}
        >
          Reativar associação ({formatMoney(rules.fee)}/mês)
        </Button>
      </section>
    )
  }

  return (
    <section className="surface-card p-4">
      <p className="text-sm font-medium">Associação</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Veja os benefícios e assine por {formatMoney(rules.fee)} ao mês no cartão, Pix ou boleto.
      </p>
      <BenefitLines rules={rules} />
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <Button
        type="button"
        className="mt-4 h-11 w-full"
        onClick={() => {
          setError("")
          setPaying(true)
        }}
      >
        Quero ser associado
      </Button>
    </section>
  )
}

function AssociateBenefits({ rules }: { rules: AssociateRules }) {
  return (
    <div className="surface-card mt-5 p-4">
      <p className="text-sm text-muted-foreground">Mensalidade</p>
      <p className="text-2xl font-semibold">
        {formatMoney(rules.fee)}{" "}
        <span className="text-sm font-normal text-muted-foreground">por mês</span>
      </p>
      <BenefitLines rules={rules} />
    </div>
  )
}

function BenefitLines({ rules }: { rules: AssociateRules }) {
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {benefitLines(rules).map((line) => (
        <li key={line} className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-teal" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

function benefitLines(rules: AssociateRules) {
  const lines = [`${rules.consultationDiscountPercent}% de desconto nas consultas pelo aplicativo`]
  if (rules.transportEnabled) lines.push(`${rules.transportRidesPerMonth} passagens de transporte no mês`)
  return [...lines, ...rules.extraBenefits]
}
