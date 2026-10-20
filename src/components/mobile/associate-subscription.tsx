"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { FlowSteps } from "@/components/shared/flow-steps"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { AssociateRules, PaymentMethod } from "@/lib/types"
import { DEMO_CARD_HINT, hasErrors, validateDemoCard } from "@/lib/validation"

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
  className = "px-4 pt-6 pb-8",
}: {
  onBack: () => void
  onConfirm: () => void | Promise<void>
  className?: string
}) {
  const fee = useDemoStore((state) => state.associateRules.fee)
  const [method, setMethod] = useState<PaymentMethod>("pix")
  const [pending, setPending] = useState(false)
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof card, string>>>({})
  const confirmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    confirmRef.current?.scrollIntoView({ block: "center" })
  }, [])

  async function confirm() {
    if (method === "card") {
      const nextErrors = validateDemoCard(card)
      setErrors(nextErrors)
      if (hasErrors(nextErrors)) return
    }
    setPending(true)
    await new Promise((resolve) => window.setTimeout(resolve, 700))
    setCard({ number: "", name: "", expiry: "", cvv: "" })
    await onConfirm()
    setPending(false)
  }

  return (
    <div className={className}>
      <button type="button" onClick={onBack} className="text-sm text-teal">Voltar</button>
      <h1 className="mt-2 text-2xl font-semibold">Confirme a assinatura</h1>
      <p className="mt-2 text-sm text-muted-foreground">A mensalidade de {formatMoney(fee)} é simulada. Nada é cobrado de verdade.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMethod("pix")} className={`rounded-2xl py-3 text-sm ${method === "pix" ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>Pix</button>
        <button type="button" onClick={() => setMethod("card")} className={`rounded-2xl py-3 text-sm ${method === "card" ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>Cartão</button>
      </div>
      {method === "card" ? (
        <div className="mt-4 space-y-3 rounded-3xl bg-white p-4 ring-1 ring-border">
          <label className="block text-sm">Nome fictício
            <Input className="mt-1 h-10" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} />
            {errors.name ? <span className="text-xs text-destructive">{errors.name}</span> : null}
          </label>
          <label className="block text-sm">Número fictício
            <Input className="mt-1 h-10" inputMode="numeric" placeholder={DEMO_CARD_HINT} value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} />
            {errors.number ? <span className="text-xs text-destructive">{errors.number}</span> : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Validade
              <Input className="mt-1 h-10" placeholder="12/30" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: event.target.value })} />
            </label>
            <label className="block text-sm">CVV
              <Input className="mt-1 h-10" placeholder="000" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} />
            </label>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-border">Pix ilustrativo da mensalidade, sem chave de cobrança.</p>
      )}
      <div ref={confirmRef}>
        <Button type="button" className="mt-5 h-12 w-full" disabled={pending} onClick={() => void confirm()}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Confirmar assinatura
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
  const rules = useDemoStore((state) => state.associateRules)
  const subscribeCurrentPatient = useDemoStore((state) => state.subscribeCurrentPatient)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState("")

  if (!patient) return null
  if (paying && associate?.status !== "active") {
    return (
      <div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        <AssociatePayForm
          onBack={() => setPaying(false)}
          onConfirm={() => {
            const result = subscribeCurrentPatient()
            if (!result.ok) setError(result.message)
            else {
              setPaying(false)
              toast.success("Assinatura de associado confirmada nesta demonstração.")
            }
          }}
        />
      </div>
    )
  }

  const active = associate?.status === "active"

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
          <p className="mt-1 text-sm text-muted-foreground">Você ainda não é associado. A associação só começa com a assinatura mensal de {formatMoney(rules.fee)}.</p>
          <BenefitLines rules={rules} />
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          <Button type="button" className="mt-4 h-11 w-full" onClick={() => { setError(""); setPaying(true) }}>
            Assinar e ser associado
          </Button>
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
