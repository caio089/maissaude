"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, Stethoscope } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cpfDigits, formatCpf } from "@/lib/cpf"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { Patient, Professional } from "@/lib/types"

type PatientItem = Pick<Patient, "id" | "name" | "cpf" | "phone" | "email" | "status"> & { snapshot?: Patient }
type ServiceItem = { id: string; professional_id: string; name: string; price: number; duration_min: number; modality: string }
type ProfessionalItem = { id: string; name: string; snapshot?: Professional }
type ClinicItem = { id: string; name: string; city: string; address: string; phone: string }
type CatalogOfferItem = { id: string; kind: string; name: string; price: number; duration_min: number; professional_id: string | null }
type AppointmentItem = {
  id: string
  patient_id: string
  professional_id: string | null
  clinic_id?: string | null
  service_id: string
  starts_at: string
  status: string
  notes?: string
  payment_id: string | null
}
type PaymentItem = {
  id: string
  status: string
  amount: number
  method: string
  invoice_url: string | null
  pix_payload: string | null
  bank_slip_url?: string | null
  identification_field?: string | null
}
type Data = {
  patients: PatientItem[]
  professionals: ProfessionalItem[]
  services: ServiceItem[]
  clinics?: ClinicItem[]
  catalogOffers?: CatalogOfferItem[]
  appointments: AppointmentItem[]
  payments: PaymentItem[]
}
type Charge = {
  amount: number
  invoiceUrl: string | null
  pix: { payload: string | null; encodedImage: string | null } | null
  pixUnavailable?: boolean
  bankSlipUrl?: string | null
  identificationField?: string | null
}

const emptyData: Data = {
  patients: [],
  professionals: [],
  services: [],
  clinics: [],
  catalogOffers: [],
  appointments: [],
  payments: [],
}
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm"

export function ConsultationsView() {
  const local = useDemoStore((state) => state.data)
  const [data, setData] = useState<Data>(emptyData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(null)
  const [patientResults, setPatientResults] = useState<PatientItem[]>([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [patientSearchError, setPatientSearchError] = useState("")

  // Modo de agendamento: consulta com médico vs exame/procedimento em clínica parceira
  const [bookingMode, setBookingMode] = useState<"doctor" | "clinic">("doctor")
  const [professionalId, setProfessionalId] = useState("")
  const [clinicId, setClinicId] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [billingType, setBillingType] = useState<"PIX" | "CREDIT_CARD" | "BOLETO">("PIX")
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
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar as consultas.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!query.trim() || selectedPatient) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`/api/desktop/patients/search?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = (await response.json()) as { patients?: PatientItem[]; error?: string }
          if (!response.ok) throw new Error(result.error || "Não foi possível buscar pacientes.")
          if (!controller.signal.aborted) {
            setPatientResults(result.patients || [])
            setSearchingPatients(false)
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          setPatientSearchError(err instanceof Error ? err.message : "Não foi possível buscar pacientes.")
          setSearchingPatients(false)
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, selectedPatient])

  const patients = useMemo(() => {
    const records = new Map<string, PatientItem>()
    for (const p of local.patients.filter((item) => item.status === "active")) {
      records.set(cpfDigits(p.cpf), { ...p, snapshot: p })
    }
    for (const p of data.patients) {
      records.set(cpfDigits(p.cpf), p)
    }
    return [...records.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [local.patients, data.patients])

  const professionals = useMemo(() => {
    const records = new Map<string, ProfessionalItem>()
    for (const p of local.professionals.filter((item) => item.active)) {
      records.set(p.id, { id: p.id, name: p.name, snapshot: p })
    }
    for (const p of data.professionals) {
      records.set(p.id, p)
    }
    return [...records.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [local.professionals, data.professionals])

  const clinics = useMemo(() => {
    return data.clinics || []
  }, [data.clinics])

  const clinicProcedures = useMemo(() => {
    return (data.catalogOffers || []).filter((o) => !o.professional_id)
  }, [data.catalogOffers])

  const professional = professionals.find((item) => item.id === professionalId)
  const patient = selectedPatient

  const doctorServices = useMemo(() => {
    if (!professional) return []
    if (professional.snapshot) {
      return professional.snapshot.services.map((service) => ({
        id: service.id,
        professional_id: professional.id,
        name: service.name,
        price: service.price,
        duration_min: service.durationMin,
        modality: service.modality,
      }))
    }
    return data.services.filter((service) => service.professional_id === professionalId)
  }, [professional, professionalId, data.services])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!patient || !date || !time) {
      toast.error("Preencha o paciente, a data e o horário.")
      return
    }

    if (bookingMode === "doctor") {
      if (!professional || !serviceId) {
        toast.error("Selecione o profissional e o procedimento.")
        return
      }
      const service = doctorServices.find((s) => s.id === serviceId)
      if (!service) {
        toast.error("Procedimento não encontrado.")
        return
      }
      const startsAt = new Date(`${date}T${time}:00-03:00`).getTime()
      const endsAt = startsAt + service.duration_min * 60000
      const conflict =
        local.appointments.some(
          (item) =>
            item.professionalId === professionalId &&
            ["scheduled", "confirmed"].includes(item.status) &&
            new Date(item.startsAt).getTime() < endsAt &&
            new Date(item.endsAt).getTime() > startsAt
        ) ||
        local.blockedSlots.some(
          (item) =>
            item.professionalId === professionalId &&
            new Date(item.startsAt).getTime() < endsAt &&
            new Date(item.endsAt).getTime() > startsAt
        )
      if (conflict) {
        toast.error("Esse horário já está ocupado ou bloqueado na agenda do médico.")
        return
      }
    } else {
      if (!serviceId) {
        toast.error("Selecione o exame ou procedimento da clínica.")
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        patientId: patient.id,
        patient: patient.snapshot,
        professionalId: bookingMode === "doctor" ? professional?.id : null,
        clinicId: bookingMode === "clinic" ? clinicId || null : null,
        professional: bookingMode === "doctor" ? professional?.snapshot : undefined,
        serviceId,
        date,
        time,
        billingType,
      }

      const response = await fetch("/api/desktop/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.error || "Não foi possível criar o agendamento.")
        await load()
        return
      }
      setCharge(result as Charge)
      if ((result as Charge).pixUnavailable) {
        toast.warning(
          "Agendamento e cobrança criados. O QR Pix não ficou disponível; use o link do Asaas ou consulte no painel."
        )
      } else {
        toast.success(
          bookingMode === "doctor" ? "Consulta agendada e cobrança criada." : "Exame/procedimento agendado com sucesso."
        )
      }
      await load()
    } catch {
      toast.error("Não foi possível confirmar o resultado. Confira no painel antes de tentar novamente.")
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Copiado.")
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="section-kicker">Atendimento</p>
        <h1 className="mt-1 text-3xl font-semibold">Agendamentos & Consultas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Agende consultas com médicos ou exames em clínicas parceiras e gere a cobrança para o paciente.
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive p-4 text-sm">
          {error}{" "}
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <h2 className="text-lg font-semibold">Novo agendamento</h2>
          <Tabs
            value={bookingMode}
            onValueChange={(val) => {
              setBookingMode(val as "doctor" | "clinic")
              setServiceId("")
            }}
          >
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="doctor" className="gap-1.5 text-xs">
                <Stethoscope className="size-3.5" /> Consulta Médica
              </TabsTrigger>
              <TabsTrigger value="clinic" className="gap-1.5 text-xs">
                <Building2 className="size-3.5" /> Exame / Clínica Parceira
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Busca de Paciente */}
          <div className="space-y-1 text-sm md:col-span-2">
            <label htmlFor="consultation-patient">Buscar paciente</label>
            <Input
              id="consultation-patient"
              value={query}
              autoComplete="off"
              placeholder="Nome, CPF, telefone ou e-mail"
              onChange={(event) => {
                const value = event.target.value
                setQuery(value)
                setSelectedPatient(null)
                setPatientResults([])
                setPatientSearchError("")
                setSearchingPatients(Boolean(value.trim()))
              }}
            />
            {selectedPatient ? (
              <p className="text-muted-foreground font-medium text-teal">
                ✓ Paciente selecionado: {selectedPatient.name} · CPF {formatCpf(selectedPatient.cpf)}
              </p>
            ) : query.trim() ? (
              <div className="max-h-48 overflow-y-auto rounded-md border" aria-live="polite">
                {searchingPatients ? (
                  <p className="p-3 text-muted-foreground">Buscando pacientes...</p>
                ) : patientSearchError ? (
                  <p role="alert" className="p-3 text-destructive">
                    {patientSearchError}
                  </p>
                ) : patientResults.length ? (
                  patientResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full border-b p-3 text-left last:border-0 hover:bg-accent focus-visible:bg-accent"
                      onClick={() => {
                        setSelectedPatient(item)
                        setQuery(item.name)
                        setPatientResults([])
                      }}
                    >
                      <span className="block font-medium">{item.name}</span>
                      <span className="text-muted-foreground">
                        CPF {formatCpf(item.cpf)} · {item.phone}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-muted-foreground">Nenhum paciente ativo encontrado no banco.</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Digite para buscar pacientes ativos cadastrados no banco.</p>
            )}
          </div>

          {bookingMode === "doctor" ? (
            <>
              <label className="space-y-1 text-sm">
                Médico ou profissional
                <select
                  className={selectClass}
                  value={professionalId}
                  onChange={(event) => {
                    setProfessionalId(event.target.value)
                    setServiceId("")
                  }}
                  required
                >
                  <option value="">Selecione o profissional</option>
                  {professionals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                Procedimento médico
                <select
                  className={selectClass}
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  required
                >
                  <option value="">Selecione o procedimento</option>
                  {doctorServices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatMoney(Number(item.price))} · {item.duration_min} min
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="space-y-1 text-sm">
                Clínica ou Laboratório onde será feito
                <select
                  className={selectClass}
                  value={clinicId}
                  onChange={(event) => setClinicId(event.target.value)}
                >
                  <option value="">CuidarSaude (Sede Padrão)</option>
                  {clinics
                    .filter((c) => c.id !== "clinic-default")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.city})
                      </option>
                    ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                Exame ou procedimento independente
                <select
                  className={selectClass}
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  required
                >
                  <option value="">Selecione o exame ou procedimento</option>
                  {clinicProcedures.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatMoney(Number(item.price))} · {item.duration_min} min
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="space-y-1 text-sm">
            Data
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="space-y-1 text-sm">
            Horário
            <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            Forma de pagamento
            <select
              className={selectClass}
              value={billingType}
              onChange={(event) => setBillingType(event.target.value as "PIX" | "CREDIT_CARD" | "BOLETO")}
            >
              <option value="PIX">Pix</option>
              <option value="CREDIT_CARD">Cartão pela fatura do Asaas</option>
              <option value="BOLETO">Boleto bancário</option>
            </select>
          </label>
        </div>

        <p className="text-sm text-muted-foreground">
          O valor será calculado pelo procedimento, com desconto automático para associados ativos se configurado.
        </p>

        <Button type="submit" disabled={saving || loading || Boolean(error)}>
          {saving ? "Criando agendamento e cobrança..." : "Agendar e gerar cobrança"}
        </Button>
      </form>

      {charge ? (
        <section className="space-y-3 rounded-2xl border bg-card p-5" aria-live="polite">
          <h2 className="text-lg font-semibold">Cobrança criada · {formatMoney(charge.amount)}</h2>
          <p className="text-sm text-muted-foreground">Aguardando confirmação do pagamento pelo Asaas.</p>
          {charge.pixUnavailable ? (
            <p className="rounded-lg bg-muted p-3 text-sm">
              O QR Pix não pôde ser carregado agora, mas a cobrança foi criada. Use o link do Asaas abaixo ou localize a
              cobrança no painel do Asaas.
            </p>
          ) : null}
          {charge.pix?.encodedImage ? (
            <img
              src={`data:image/png;base64,${charge.pix.encodedImage}`}
              alt="QR Code Pix da consulta"
              className="size-48"
            />
          ) : null}
          {charge.pix?.payload ? (
            <div className="space-y-2">
              <Input readOnly value={charge.pix.payload} aria-label="Pix copia e cola" />
              <Button variant="outline" onClick={() => void copy(charge.pix!.payload!)}>
                Copiar Pix
              </Button>
            </div>
          ) : null}
          {charge.identificationField ? (
            <div className="space-y-2">
              <Input readOnly value={charge.identificationField} aria-label="Linha digitável do boleto" />
              <Button variant="outline" onClick={() => void copy(charge.identificationField!)}>
                Copiar linha digitável
              </Button>
            </div>
          ) : null}
          {charge.bankSlipUrl || charge.invoiceUrl ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={charge.bankSlipUrl || charge.invoiceUrl!} target="_blank" rel="noreferrer">
                  {charge.bankSlipUrl ? "Abrir boleto" : "Abrir link de pagamento"}
                </a>
              </Button>
              <Button variant="outline" onClick={() => void copy(charge.bankSlipUrl || charge.invoiceUrl!)}>
                Copiar link
              </Button>
            </div>
          ) : null}
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            O boleto pode levar até 3 dias úteis para compensar. O atendimento continua agendado até a confirmação.
          </p>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <div className="flex justify-between gap-3">
          <h2 className="text-lg font-semibold">Atendimentos e Consultas Registradas</h2>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Atualizar status
          </Button>
        </div>
        {loading ? (
          <p className="text-sm">Carregando...</p>
        ) : data.appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atendimento registrado no banco.</p>
        ) : (
          <div className="space-y-2">
            {data.appointments.map((appointment) => {
              const payment = data.payments.find((p) => p.id === appointment.payment_id)
              const patientObj = patients.find((p) => p.id === appointment.patient_id)
              const professionalObj = appointment.professional_id
                ? professionals.find((p) => p.id === appointment.professional_id)
                : null
              const clinicObj = appointment.clinic_id
                ? clinics.find((c) => c.id === appointment.clinic_id)
                : null

              const doctorService = data.services.find((s) => s.id === appointment.service_id)
              const clinicOffer = data.catalogOffers?.find((o) => o.id === appointment.service_id)
              const serviceName = doctorService?.name || clinicOffer?.name || "Procedimento"

              const providerLabel = professionalObj
                ? professionalObj.name
                : clinicObj
                  ? clinicObj.name
                  : (appointment as any).clinic_name
                    ? (appointment as any).clinic_name
                    : appointment.notes?.includes("[Clínica:")
                      ? appointment.notes.replace(/^\[Clínica:\s*([^\]]+)\].*$/, "$1")
                      : "Clínica Geral (Exame)"

              return (
                <div key={appointment.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {patientObj?.name || "Paciente"} · {providerLabel}
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
                      {appointment.status === "scheduled"
                        ? "Agendado"
                        : appointment.status === "confirmed"
                          ? "Confirmado"
                          : appointment.status === "completed"
                            ? "Concluído"
                            : appointment.status === "cancelled"
                              ? "Cancelado"
                              : appointment.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">
                    {serviceName} · {formatDate(appointment.starts_at, "dd/MM/yyyy HH:mm")} ·{" "}
                    {payment
                      ? `Pagamento: ${{
                          pending: "pendente",
                          paid: "pago",
                          declined: "recusado",
                          refunded: "estornado",
                        }[payment.status] || payment.status}`
                      : "Sem pagamento vinculado"}
                  </p>
                  {payment?.invoice_url && payment.status === "pending" ? (
                    <a href={payment.invoice_url} target="_blank" rel="noreferrer" className="text-teal underline mr-3">
                      {payment.method === "boleto" ? "Abrir boleto" : "Abrir cobrança"}
                    </a>
                  ) : null}
                  {payment?.pix_payload && payment.status === "pending" ? (
                    <Button variant="link" size="sm" onClick={() => void copy(payment.pix_payload!)} className="px-0 mr-3">
                      Copiar Pix
                    </Button>
                  ) : null}
                  {payment?.method === "boleto" && payment.status === "pending" && payment.identification_field ? (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => void copy(payment.identification_field!)}
                      className="px-0"
                    >
                      Copiar linha digitável
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
