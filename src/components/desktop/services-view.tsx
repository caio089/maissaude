"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ServiceFields } from "@/components/desktop/service-fields"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"
import type { Professional, Service } from "@/lib/types"

export function ServicesView() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [professionalId, setProfessionalId] = useState("")
  const [services, setServices] = useState<Service[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function refresh() {
    const response = await fetch("/api/desktop/professionals", { cache: "no-store" })
    const result = await response.json() as { professionals?: Professional[]; error?: string }
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os profissionais.")
    setProfessionals(result.professionals || [])
    setError("")
  }
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/desktop/professionals", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { professionals?: Professional[]; error?: string }
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar os profissionais.")
        if (!controller.signal.aborted) setProfessionals(result.professionals || [])
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível carregar os profissionais.") })
    return () => controller.abort()
  }, [])
  const selected = professionals.find((p) => p.id === professionalId)
  async function save() {
    if (!professionalId || !services.length || services.some((s) => !s.name.trim() || s.price <= 0 || !Number.isInteger(s.durationMin) || s.durationMin <= 0)) {
      toast.error("Selecione o profissional e preencha os atendimentos.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/desktop/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ professionalId, services }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar os atendimentos.")
      setServices([])
      try { await refresh() } catch { toast.warning("Atendimentos salvos. Atualize a página para conferi-los.") }
      toast.success("Atendimentos vinculados ao profissional.")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível salvar os atendimentos.") }
    finally { setSaving(false) }
  }
  return <div className="space-y-5">
    <div><p className="section-kicker">Cadastro</p><h1 className="mt-1 text-3xl font-semibold">Consultas e procedimentos</h1><p className="mt-2 text-sm text-muted-foreground">Cadastre consultas, procedimentos, exames e cirurgias para cada profissional.</p></div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <label className="block space-y-1 text-sm">Profissional<select value={professionalId} onChange={(event) => { setProfessionalId(event.target.value); setServices([]) }} className="h-10 w-full rounded-md border border-input bg-background px-3"><option value="">Selecione</option>{professionals.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {selected ? <div><h2 className="font-semibold">Atendimentos cadastrados</h2>{selected.services.length ? <ul className="mt-2 space-y-1 text-sm">{selected.services.map((s) => <li key={s.id}>{s.name} · {formatMoney(s.price)} · {s.durationMin} min</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Nenhum atendimento cadastrado.</p>}</div> : null}
      <ServiceFields services={services} onChange={setServices} />
      <Button type="button" onClick={() => void save()} disabled={saving || !professionalId}>{saving ? "Salvando..." : "Salvar atendimentos"}</Button>
    </div>
  </div>
}
