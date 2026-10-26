"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Service } from "@/lib/types"

export function ServiceFields({ services, onChange, savedIds = [] }: { services: Service[]; onChange: (services: Service[]) => void; savedIds?: string[] }) {
  function update(id: string, patch: Partial<Service>) {
    onChange(services.map((service) => service.id === id ? { ...service, ...patch } : service))
  }
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Consultas e procedimentos</h3><Button type="button" size="sm" variant="outline" onClick={() => onChange([...services, { id: `svc-${crypto.randomUUID()}`, name: "", kind: "consulta", price: 0, durationMin: 40, modality: "presencial" }])}><Plus /> Adicionar</Button></div>
    {services.length === 0 ? <p className="text-sm text-muted-foreground">Adicione os atendimentos realizados por este profissional.</p> : null}
    {services.map((service, index) => <fieldset key={service.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium">Atendimento {index + 1}</legend>
      <label className="space-y-1 text-sm sm:col-span-2">Nome<Input value={service.name} onChange={(event) => update(service.id, { name: event.target.value })} placeholder="Ex.: consulta, exame ou cirurgia" /></label>
      <label className="space-y-1 text-sm">Tipo<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={service.kind || "consulta"} onChange={(event) => update(service.id, { kind: event.target.value as Service["kind"] })}><option value="consulta">Consulta</option><option value="exame">Procedimento ou exame</option><option value="cirurgia">Cirurgia</option></select></label>
      <label className="space-y-1 text-sm">Modalidade<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={service.modality} onChange={(event) => update(service.id, { modality: event.target.value as Service["modality"] })}><option value="presencial">Presencial</option><option value="teleconsulta">Teleconsulta</option></select></label>
      <label className="space-y-1 text-sm">Valor (R$)<Input type="number" min="0.01" max="50000" step="0.01" value={service.price} onChange={(event) => update(service.id, { price: Number(event.target.value) })} /></label>
      <label className="space-y-1 text-sm">Duração (minutos)<Input type="number" min="1" max="1440" step="1" value={service.durationMin} onChange={(event) => update(service.id, { durationMin: Number(event.target.value) })} /></label>
      {!savedIds.includes(service.id) ? <Button type="button" variant="outline" size="sm" className="sm:col-span-2" onClick={() => onChange(services.filter((item) => item.id !== service.id))}>Remover atendimento ainda não salvo</Button> : null}
    </fieldset>)}
  </div>
}
