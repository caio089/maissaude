"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2 } from "lucide-react"
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
  className = "px-4 pt-6 pb-8",
}: {
  onBack: () => void
  onConfirm: () => void | Promise<void>
  className?: string
}) {
  const fee = useDemoStore((state) => state.associateRules.fee)
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
      <h1 className="mt-2 text-2xl font-semibold">Confirme a assinatura</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A mensalidade de {formatMoney(fee)} segue o ciclo mensal da Asaas. Nesta demonstração o Pix ainda é ilustrativo; cartão não é capturado neste aplicativo.
      </p>
      <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-border">
        Assinatura recorrente via Pix. A Asaas gera as cobranças ao longo do mês; o webhook confirma cada pagamento.
      </p>
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
