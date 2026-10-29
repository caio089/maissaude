"use client"

import { useEffect, useRef, useState } from "react"
import { Check, CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { FlowSteps } from "@/components/shared/flow-steps"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { AssociateRules } from "@/lib/types"

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
        <button type="button" onClick={onBack} className="text-sm text-teal">Voltar</button>
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
        <button type="button" className="mt-3 w-full text-sm text-teal" disabled={pending} onClick={onSecondary}>
          {secondaryLabel}
        </button>
      ) : null}
    </div>
  )
}

export function AssociatePayForm({
  onBack,
  onConfirm,
  rules,
  className = "px-4 pt-6 pb-8",
}: {
  onBack: () => void
  onConfirm: () => void | Promise<void>
  rules: AssociateRules
  className?: string
}) {
  const [pending, setPending] = useState(false)
  const confirmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    confirmRef.current?.scrollIntoView({ block: "center" })
  }, [])

  async function confirm() {
    setPending(true)
    await new Promise((resolve) => window.setTimeout(resolve, 700))
    await onConfirm()
    setPending(false)
  }

  return (
    <div className={className}>
      <button type="button" onClick={onBack} className="text-sm text-teal">Voltar</button>
      <p className="section-kicker mt-4">Plano de associado</p>
      <h1 className="mt-2 text-2xl font-semibold">Veja tudo antes de assinar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A mensalidade é de {formatMoney(rules.fee)} por mês, cobrada somente no cartão pela página protegida da Asaas.
      </p>
      <AssociateBenefits rules={rules} />
      <section className="surface-card mt-4 p-4">
        <h2 className="font-semibold">Como funciona</h2>
        <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-medium text-teal">1</span><span>Você revisa a mensalidade e todos os benefícios.</span></li>
          <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-medium text-teal">2</span><span>Abrimos a página segura da Asaas para você informar o cartão.</span></li>
          <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-medium text-teal">3</span><span>A Asaas cria a cobrança recorrente mensal e envia a confirmação ao aplicativo.</span></li>
          <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-medium text-teal">4</span><span>Os benefícios são ativados somente após a confirmação do primeiro pagamento.</span></li>
        </ol>
      </section>
      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#e9eef8] p-4 text-sm text-[#365f8b]">
        <CreditCard className="mt-0.5 size-4 shrink-0" /> A mensalidade não aceita Pix. Os dados do cartão ficam com a Asaas e não são armazenados neste aplicativo.
      </p>
      <div ref={confirmRef}>
        <Button type="button" className="mt-5 h-12 w-full" disabled={pending} onClick={() => void confirm()}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Continuar para o cartão
        </Button>
      </div>
    </div>
  )
}

export function AssociateAccountPanel() {
  const patientId = useDemoStore((state) => state.mobileSessionPatientId)
  const patient = useDemoStore((state) => state.data.patients.find((item) => item.id === patientId))
  const associates = useDemoStore((state) => state.associates)
  const associate = associates.find((item) => item.cpf.trim() === patient?.cpf?.trim())
  const localRules = useDemoStore((state) => state.associateRules)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState("")
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [membership, setMembership] = useState<{ active: boolean; subscriptionStatus: string | null; rules: AssociateRules } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/payments/subscription", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { active?: boolean; subscriptionStatus?: string | null; rules?: AssociateRules }
        if (response.ok && body.rules) setMembership({ active: Boolean(body.active), subscriptionStatus: body.subscriptionStatus || null, rules: body.rules })
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("associar") === "1") {
      queueMicrotask(() => setPaying(true))
    }
  }, [])

  if (!patient) return null
  const rules = membership?.rules ?? localRules
  const active = membership?.active ?? associate?.status === "active"
  const subscriptionPending = Boolean(membership?.subscriptionStatus && !active)

  if (paymentUrl) {
    return (
      <section className="surface-card p-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#e9eef8] text-[#365f8b]"><ShieldCheck className="size-6" /></span>
        <h2 className="mt-3 text-lg font-semibold">Página segura pronta</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Abra a Asaas, informe o cartão e conclua a assinatura mensal. A associação será ativada após a confirmação do pagamento.</p>
        <Button asChild className="mt-4 h-12 w-full">
          <a href={paymentUrl} target="_blank" rel="noreferrer">Ir para a Asaas e cadastrar cartão <ExternalLink className="size-4" /></a>
        </Button>
        <button type="button" className="mt-3 w-full text-sm text-teal" onClick={() => setPaymentUrl(null)}>Voltar aos detalhes</button>
      </section>
    )
  }

  if (paying && !active) {
    return (
      <div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        <AssociatePayForm
          rules={rules}
          onBack={() => setPaying(false)}
          onConfirm={async () => {
            const response = await fetch("/api/payments/subscription", { method: "POST" })
            const body = await response.json() as { error?: string; paymentUrl?: string | null }
            if (!response.ok || !body.paymentUrl) {
              setError(body.error || "Não foi possível abrir a página segura do cartão.")
              return
            }
            setPaymentUrl(body.paymentUrl)
            toast.success("Página segura da Asaas gerada.")
          }}
        />
      </div>
    )
  }

  return (
    <section className="surface-card p-4">
      <p className="text-sm font-medium">{active ? "Assinatura ativa" : "Associação"}</p>
      {active ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Mensalidade de {formatMoney(rules.fee)}. O desconto entra nas consultas pagas pelo aplicativo.</p>
          <BenefitLines rules={rules} />
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{subscriptionPending ? "Sua assinatura está aguardando a confirmação da Asaas." : `Veja os benefícios e assine por ${formatMoney(rules.fee)} ao mês no cartão.`}</p>
          <BenefitLines rules={rules} />
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          {!subscriptionPending ? <Button type="button" className="mt-4 h-11 w-full" onClick={() => { setError(""); setPaying(true) }}>Quero ser associado</Button> : null}
        </>
      )}
    </section>
  )
}

function AssociateBenefits({ rules }: { rules: AssociateRules }) {
  return (
    <div className="surface-card mt-5 p-4">
      <p className="text-sm text-muted-foreground">Mensalidade</p>
      <p className="text-2xl font-semibold">{formatMoney(rules.fee)} <span className="text-sm font-normal text-muted-foreground">por mês</span></p>
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
