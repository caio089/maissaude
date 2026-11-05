"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Field } from "@/components/shared/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { associateRulesError, MIN_ASSOCIATE_FEE, normalizeAssociateRules } from "@/lib/associate-rules"
import { formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { AssociateRules, ClinicRole } from "@/lib/types"

export interface AssociateRulesCardProps {
  role?: ClinicRole
}

export function AssociateRulesCard({ role: propRole }: AssociateRulesCardProps = {}) {
  const [role, setRole] = useState<ClinicRole | null>(propRole ?? null)
  const saved = useDemoStore((state) => state.associateRules)
  const updateAssociateRules = useDemoStore((state) => state.updateAssociateRules)
  const [draft, setDraft] = useState<AssociateRules>(saved)

  useEffect(() => {
    if (propRole) {
      setRole(propRole)
      return
    }
    let active = true
    fetch("/api/desktop/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.authenticated) setRole(data.role)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [propRole])

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/desktop/associate-rules", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { rules?: AssociateRules }
        if (!response.ok || !body.rules) return
        const rules = normalizeAssociateRules(body.rules)
        setDraft(rules)
        updateAssociateRules(rules)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [updateAssociateRules])

  async function save() {
    if (role === "attendant") {
      toast.error("Ação restrita à administração da clínica.")
      return
    }
    const candidate: AssociateRules = {
      ...draft,
      fee: Number(draft.fee),
      consultationDiscountPercent: Number(draft.consultationDiscountPercent),
      transportRidesPerMonth: Number(draft.transportRidesPerMonth),
    }
    const message = associateRulesError(candidate)
    if (message) {
      toast.error(message)
      return
    }
    const next = normalizeAssociateRules(candidate)
    const response = await fetch("/api/desktop/associate-rules", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    })
    const body = await response.json() as { error?: string; rules?: AssociateRules }
    if (!response.ok || !body.rules) {
      toast.error(body.error || "Não foi possível salvar as regras.")
      return
    }
    const result = updateAssociateRules(next)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    setDraft(next)
    toast.success("Regras do associado atualizadas.")
  }

  return (
    <section className="panel space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold">Regras do associado</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Todo associado ativo paga {formatMoney(saved.fee)} e usa este pacote. O desconto entra na consulta paga pelo aplicativo. Transporte e os outros itens são direitos do associado.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Mensalidade" htmlFor="associate-fee" hint="Para testar o cartão na Asaas, use a partir de R$ 5.">
          <Input id="associate-fee" type="number" min={MIN_ASSOCIATE_FEE} max="500" step="0.01" className="h-10" inputMode="decimal" value={draft.fee} onChange={(event) => setDraft({ ...draft, fee: Number(event.target.value) })} />
        </Field>
        <Field label="Desconto na consulta (%)" htmlFor="associate-discount" hint="Vale no pagamento pelo aplicativo. Até 80%.">
          <Input id="associate-discount" className="h-10" inputMode="numeric" value={draft.consultationDiscountPercent} onChange={(event) => setDraft({ ...draft, consultationDiscountPercent: Number(event.target.value) })} />
        </Field>
        <Field label="Passagens por mês" htmlFor="associate-rides">
          <Input id="associate-rides" className="h-10" inputMode="numeric" disabled={!draft.transportEnabled} value={draft.transportRidesPerMonth} onChange={(event) => setDraft({ ...draft, transportRidesPerMonth: Number(event.target.value) })} />
        </Field>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
        Direito a transporte
        <Switch checked={draft.transportEnabled} onCheckedChange={(transportEnabled) => setDraft({ ...draft, transportEnabled })} />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Outros direitos</p>
        {draft.extraBenefits.map((benefit, index) => (
          <div key={index} className="flex gap-2">
            <Input
              aria-label={`Benefício ${index + 1}`}
              className="h-10"
              value={benefit}
              onChange={(event) => {
                const extraBenefits = draft.extraBenefits.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))
                setDraft({ ...draft, extraBenefits })
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft({ ...draft, extraBenefits: draft.extraBenefits.filter((_, itemIndex) => itemIndex !== index) })}
            >
              Remover
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={draft.extraBenefits.length >= 6}
          onClick={() => setDraft({ ...draft, extraBenefits: [...draft.extraBenefits, ""] })}
        >
          Adicionar direito
        </Button>
      </div>
      {role !== "attendant" && (
        <Button type="button" onClick={save}>Salvar regras</Button>
      )}
    </section>
  )
}
