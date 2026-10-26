"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cpfDigits, formatCpf } from "@/lib/cpf"
import { formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { Patient, Professional } from "@/lib/types"

type PatientItem = Pick<Patient, "id" | "name" | "cpf" | "phone" | "email" | "status"> & { snapshot?: Patient }
type ServiceItem = { id: string; professional_id: string; name: string; price: number; duration_min: number; modality: string }
type ProfessionalItem = { id: string; name: string; snapshot?: Professional }
type AppointmentItem = { id: string; patient_id: string; professional_id: string; service_id: string; starts_at: string; status: string; payment_id: string | null }
type PaymentItem = { id: string; status: string; amount: number; method: string; invoice_url: string | null; pix_payload: string | null }
type Data = { patients: PatientItem[]; professionals: ProfessionalItem[]; services: ServiceItem[]; appointments: AppointmentItem[]; payments: PaymentItem[] }
type Charge = { amount: number; invoiceUrl: string | null; pix: { payload: string | null; encodedImage: string | null } | null }

const emptyData: Data = { patients: [], professionals: [], services: [], appointments: [], payments: [] }
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm"

export function ConsultationsView() {
  const local = useDemoStore((state) => state.data)
  const [data, setData] = useState<Data>(emptyData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [patientId, setPatientId] = useState("")
  const [professionalId, setProfessionalId] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [billingType, setBillingType] = useState<"PIX" | "CREDIT_CARD">("PIX")
  const [charge, setCharge] = useState<Charge | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/desktop/consultations", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar as consultas.")
      setData(result as Data)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as consultas.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    let active = true
    fetch("/api/desktop/consultations", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar as consultas.")
        if (active) setData(result as Data)
      })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar as consultas.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const patients = useMemo(() => {
    const records = new Map<string, PatientItem>()
    for (const patient of local.patients.filter((item) => item.status === "active")) records.set(cpfDigits(patient.cpf), { ...patient, snapshot: patient })
    for (const patient of data.patients) records.set(cpfDigits(patient.cpf), patient)
    return [...records.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [local.patients, data.patients])
  const professionals = useMemo(() => {
    const records = new Map<string, ProfessionalItem>()
    for (const professional of local.professionals.filter((item) => item.active)) records.set(professional.id, { id: professional.id, name: professional.name, snapshot: professional })
    for (const professional of data.professionals) records.set(professional.id, professional)
    return [...records.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [local.professionals, data.professionals])
  const professional = professionals.find((item) => item.id === professionalId)
  const patient = patients.find((item) => item.id === patientId)
  const services = professional?.snapshot ? professional.snapshot.services.map((service) => ({ id: service.id, professional_id: professional.id, name: service.name, price: service.price, duration_min: service.durationMin, modality: service.modality })) : data.services.filter((service) => service.professional_id === professionalId)
  const service = services.find((item) => item.id === serviceId)
  const visiblePatients = patients.filter((item) => `${item.name} ${item.cpf} ${item.phone}`.toLowerCase().includes(query.toLowerCase().trim()))

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!patient || !professional || !service || !date || !time) { toast.error("Preencha todos os campos."); return }
    const startsAt = new Date(`${date}T${time}:00-03:00`).getTime()
    const endsAt = startsAt + service.duration_min * 60000
    const conflict = local.appointments.some((item) => item.professionalId === professionalId && ["scheduled", "confirmed"].includes(item.status) && new Date(item.startsAt).getTime() < endsAt && new Date(item.endsAt).getTime() > startsAt)
      || local.blockedSlots.some((item) => item.professionalId === professionalId && new Date(item.startsAt).getTime() < endsAt && new Date(item.endsAt).getTime() > startsAt)
    if (conflict) { toast.error("Esse horário já está ocupado ou bloqueado na agenda deste navegador."); return }
    setSaving(true)
    try {
      const response = await fetch("/api/desktop/consultations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: patient.id, patient: patient.snapshot, professionalId: professional.id, professional: professional.snapshot, serviceId, date, time, billingType }) })
      const result = await response.json()
      if (!response.ok) { toast.error(result.error || "Não foi possível criar a consulta."); await load(); return }
      setCharge(result as Charge)
      toast.success("Consulta agendada e cobrança criada.")
      await load()
    } catch {
      toast.error("Não foi possível confirmar o resultado. Confira a consulta e o Asaas antes de tentar novamente.")
      await load()
    } finally { setSaving(false) }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success("Copiado.") } catch { toast.error("Não foi possível copiar. Selecione o texto manualmente.") }
  }

  return (
    <div className="space-y-6">
      <div><p className="section-kicker">Atendimento</p><h1 className="mt-1 text-3xl font-semibold">Consultas</h1><p className="mt-2 text-sm text-muted-foreground">Agende o atendimento e gere uma cobrança para o paciente.</p></div>
      {error ? <div role="alert" className="rounded-xl border border-destructive p-4 text-sm">{error} <Button variant="outline" size="sm" onClick={() => void load()}>Tentar novamente</Button></div> : null}
      <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Nova consulta</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">Buscar paciente<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, CPF ou telefone" /></label>
          <label className="space-y-1 text-sm">Paciente<select className={selectClass} value={patientId} onChange={(event) => setPatientId(event.target.value)} required><option value="">Selecione</option>{visiblePatients.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatCpf(item.cpf)}</option>)}</select></label>
          <label className="space-y-1 text-sm">Médico ou profissional<select className={selectClass} value={professionalId} onChange={(event) => { setProfessionalId(event.target.value); setServiceId("") }} required><option value="">Selecione</option>{professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="space-y-1 text-sm">Procedimento<select className={selectClass} value={serviceId} onChange={(event) => setServiceId(event.target.value)} required><option value="">Selecione</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatMoney(Number(item.price))} · {item.duration_min} min</option>)}</select></label>
          <label className="space-y-1 text-sm">Data<Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label className="space-y-1 text-sm">Horário<Input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
          <label className="space-y-1 text-sm">Forma de pagamento<select className={selectClass} value={billingType} onChange={(event) => setBillingType(event.target.value as "PIX" | "CREDIT_CARD")}><option value="PIX">Pix</option><option value="CREDIT_CARD">Cartão pela fatura do Asaas</option></select></label>
        </div>
        <p className="text-sm text-muted-foreground">O valor será calculado pelo procedimento, com desconto para associados ativos quando configurado.</p>
        <Button type="submit" disabled={saving || loading || Boolean(error)}>{saving ? "Criando cobrança..." : "Agendar e gerar cobrança"}</Button>
      </form>
      {charge ? <section className="space-y-3 rounded-2xl border bg-card p-5" aria-live="polite"><h2 className="text-lg font-semibold">Cobrança criada · {formatMoney(charge.amount)}</h2><p className="text-sm text-muted-foreground">Aguardando confirmação do pagamento pelo Asaas.</p>{charge.pix?.encodedImage ? <img src={`data:image/png;base64,${charge.pix.encodedImage}`} alt="QR Code Pix da consulta" className="size-48" /> : null}{charge.pix?.payload ? <div className="space-y-2"><Input readOnly value={charge.pix.payload} aria-label="Pix copia e cola" /><Button variant="outline" onClick={() => void copy(charge.pix!.payload!)}>Copiar Pix</Button></div> : null}{charge.invoiceUrl ? <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={charge.invoiceUrl} target="_blank" rel="noreferrer">Abrir link de pagamento</a></Button><Button variant="outline" onClick={() => void copy(charge.invoiceUrl!)}>Copiar link</Button></div> : null}</section> : null}
      <section className="space-y-3 rounded-2xl border bg-card p-5"><div className="flex justify-between gap-3"><h2 className="text-lg font-semibold">Consultas registradas</h2><Button variant="outline" size="sm" onClick={() => void load()}>Atualizar status</Button></div>{loading ? <p className="text-sm">Carregando...</p> : data.appointments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma consulta registrada no banco.</p> : <div className="space-y-2">{data.appointments.map((appointment) => { const item = data.payments.find((payment) => payment.id === appointment.payment_id); return <div key={appointment.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{patients.find((p) => p.id === appointment.patient_id)?.name || "Paciente"} · {professionals.find((p) => p.id === appointment.professional_id)?.name || "Profissional"}</p><p className="text-muted-foreground">{data.services.find((s) => s.id === appointment.service_id)?.name || "Procedimento"} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(appointment.starts_at))} · {item ? `Pagamento: ${{ pending: "pendente", paid: "pago", declined: "recusado", refunded: "estornado" }[item.status] || item.status}` : "Sem pagamento vinculado"}</p>{item?.invoice_url && item.status === "pending" ? <a href={item.invoice_url} target="_blank" rel="noreferrer" className="text-teal underline">Abrir cobrança</a> : null}{item?.pix_payload && item.status === "pending" ? <Button variant="link" size="sm" onClick={() => void copy(item.pix_payload!)}>Copiar Pix</Button> : null}</div> })}</div>}</section>
    </div>
  )
}
