"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Calendar, Plus, Receipt, Search, Users } from "lucide-react"
import { toast } from "sonner"
import { FadeIn } from "@/components/shared/fade-in"
import { EmptyState } from "@/components/shared/empty-state"
import { Portrait } from "@/components/shared/portrait"
import { PaymentBadge, StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { emptyPatientForm, PatientForm, patientFormErrors } from "@/components/desktop/patient-form"
import { formatDate, formatMoney } from "@/lib/format"
import { cpfDigits } from "@/lib/cpf"
import { mapDbAppointment, mapDbPayment } from "@/lib/desktop-sync"
import { useDemoStore } from "@/lib/store"
import type { Appointment, Patient, PatientInput, PatientStatus, Payment, Professional } from "@/lib/types"
import { hasErrors } from "@/lib/validation"

const PAGE_SIZE = 8

export function PatientsView() {
  const data = useDemoStore((state) => state.data)
  const search = useDemoStore((state) => state.patientSearch)
  const setSearch = useDemoStore((state) => state.setPatientSearch)
  const focusId = useDemoStore((state) => state.patientFocusId)
  const setFocusId = useDemoStore((state) => state.setPatientFocusId)
  const [serverPatients, setServerPatients] = useState<Patient[]>([])
  const [serverAppointments, setServerAppointments] = useState<Appointment[]>([])
  const [serverPayments, setServerPayments] = useState<Payment[]>([])
  const [serverProfessionals, setServerProfessionals] = useState<Professional[]>([])
  const [loadError, setLoadError] = useState("")
  const [saving, setSaving] = useState(false)
  const syncedLocalPatients = useRef(false)
  const [status, setStatus] = useState<PatientStatus | "all">("all")
  const [page, setPage] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [form, setForm] = useState<PatientInput>(() => emptyPatientForm([]))
  const [errors, setErrors] = useState<Partial<Record<keyof PatientInput, string>>>({})

  const patients = useMemo(() => {
    const records = new Map<string, Patient>()
    for (const patient of data.patients) records.set(patient.id, patient)
    for (const patient of serverPatients) records.set(patient.id, patient)
    return [...records.values()]
  }, [data.patients, serverPatients])

  const allAppointments = useMemo(() => {
    const map = new Map<string, Appointment>()
    for (const item of data.appointments) map.set(item.id, item)
    for (const item of serverAppointments) map.set(item.id, item)
    return [...map.values()]
  }, [data.appointments, serverAppointments])

  const allPayments = useMemo(() => {
    const map = new Map<string, Payment>()
    for (const item of data.payments) map.set(item.id, item)
    for (const item of serverPayments) map.set(item.id, item)
    return [...map.values()]
  }, [data.payments, serverPayments])

  const allProfessionals = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const item of data.professionals) map.set(item.id, { id: item.id, name: item.name })
    for (const item of serverProfessionals) map.set(item.id, { id: item.id, name: item.name })
    return map
  }, [data.professionals, serverProfessionals])

  async function refresh() {
    const response = await fetch("/api/desktop/patients", { cache: "no-store" })
    const result = (await response.json()) as { patients?: Patient[]; error?: string }
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os pacientes.")
    setServerPatients(result.patients || [])
    setLoadError("")
    return result.patients || []
  }

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const remote = await refresh()
        if (syncedLocalPatients.current) return
        syncedLocalPatients.current = true
        const remoteKeys = new Set(
          remote.flatMap((patient) => [patient.id, patient.cpf.replace(/\D/g, ""), patient.email.trim().toLowerCase()]),
        )
        const pending = data.patients.filter(
          (patient) =>
            !remoteKeys.has(patient.id) &&
            !remoteKeys.has(patient.cpf.replace(/\D/g, "")) &&
            !remoteKeys.has(patient.email.trim().toLowerCase()),
        )
        if (!pending.length) return
        const synced = await Promise.all(
          pending.map((patient) =>
            fetch("/api/desktop/patients", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: patient.id,
                form: {
                  name: patient.name,
                  cpf: patient.cpf,
                  phone: patient.phone,
                  email: patient.email,
                  birthDate: patient.birthDate,
                  gender: patient.gender,
                  address: patient.address,
                  city: patient.city,
                  status: patient.status,
                  notes: patient.notes,
                },
              }),
            }),
          ),
        )
        if (synced.some((response) => !response.ok)) {
          throw new Error("Não foi possível salvar alguns pacientes que estavam somente neste navegador.")
        }
        if (active) await refresh()
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os pacientes.")
      }
    })()

    // Carrega também consultas e pagamentos do banco para exibir nos detalhes do paciente
    fetch("/api/desktop/consultations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return
        const body = await response.json()
        if (active) {
          if (Array.isArray(body.appointments)) {
            setServerAppointments(body.appointments.map(mapDbAppointment))
          }
          if (Array.isArray(body.payments)) {
            setServerPayments(body.payments.map(mapDbPayment))
          }
          if (Array.isArray(body.professionals)) {
            setServerProfessionals(body.professionals)
          }
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [data.patients])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return patients.filter((patient) => {
      if (status !== "all" && patient.status !== status) return false
      if (!query) return true
      return [patient.name, patient.cpf, patient.email, patient.phone].some((value) => value.toLowerCase().includes(query))
    })
  }, [patients, search, status])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visiblePage = Math.min(page, pages - 1)
  const rows = filtered.slice(visiblePage * PAGE_SIZE, visiblePage * PAGE_SIZE + PAGE_SIZE)
  const focused = patients.find((patient) => patient.id === focusId) ?? null

  const focusedIds = useMemo(() => {
    if (!focused) return new Set<string>()
    const ids = new Set<string>([focused.id])
    const cleanCpf = cpfDigits(focused.cpf)
    if (cleanCpf) {
      for (const p of patients) {
        if (cpfDigits(p.cpf) === cleanCpf) {
          ids.add(p.id)
        }
      }
    }
    return ids
  }, [focused, patients])

  const focusedAppointments = useMemo(() => {
    if (!focused) return []
    return allAppointments
      .filter((item) => focusedIds.has(item.patientId))
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
  }, [focused, focusedIds, allAppointments])

  const focusedPayments = useMemo(() => {
    if (!focused) return []
    return allPayments
      .filter((item) => focusedIds.has(item.patientId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [focused, focusedIds, allPayments])

  function openCreate() {
    setEditing(null)
    setForm(emptyPatientForm(patients))
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(patient: Patient) {
    setEditing(patient)
    setForm({
      name: patient.name,
      cpf: patient.cpf,
      phone: patient.phone,
      email: patient.email,
      birthDate: patient.birthDate,
      gender: patient.gender,
      address: patient.address,
      city: patient.city,
      status: patient.status,
      notes: patient.notes,
    })
    setErrors({})
    setFormOpen(true)
  }

  async function save() {
    const nextErrors = patientFormErrors(form, patients, editing?.id)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    setSaving(true)
    try {
      const id = editing?.id || `pat-${crypto.randomUUID()}`
      const response = await fetch("/api/desktop/patients", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, form }),
      })
      const result = (await response.json()) as { patient?: Patient; error?: string }
      if (!response.ok || !result.patient) throw new Error(result.error || "Não foi possível salvar o paciente.")
      await refresh()
      setFocusId(result.patient.id)
      setFormOpen(false)
      toast.success(editing ? "Cadastro atualizado no banco." : "Paciente cadastrado no banco.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o paciente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <FadeIn className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Cadastro</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patients.length} {patients.length === 1 ? "paciente cadastrado" : "pacientes cadastrados"}.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus /> Novo paciente
        </Button>
      </div>

      <div className="panel flex flex-wrap gap-3 p-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, CPF, telefone ou e-mail"
            aria-label="Pesquisar pacientes"
            className="h-10 pl-9"
          />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as PatientStatus | "all")}>
          <SelectTrigger className="h-10 w-40" aria-label="Filtrar status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <div className="panel overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum paciente encontrado"
            description="Ajuste a pesquisa ou cadastre o primeiro paciente."
            action={
              <Button type="button" onClick={openCreate}>
                Cadastrar
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última consulta</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((patient) => {
                const cleanCpf = cpfDigits(patient.cpf)
                const last = allAppointments
                  .filter((item) => item.patientId === patient.id || (cleanCpf && cleanCpf === cpfDigits(patients.find((p) => p.id === item.patientId)?.cpf || "")))
                  .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0]
                return (
                  <TableRow key={patient.id} className="cursor-pointer" onClick={() => setFocusId(patient.id)}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <Portrait seed={patient.name} name={patient.name} className="size-9" />
                        <span>
                          <span className="block font-medium">{patient.name}</span>
                          <span className="block text-xs text-muted-foreground">CPF {patient.cpf}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block">{patient.phone}</span>
                      <span className="block text-xs text-muted-foreground">{patient.email}</span>
                    </TableCell>
                    <TableCell>{patient.city}</TableCell>
                    <TableCell>{patient.status === "active" ? "Ativo" : "Inativo"}</TableCell>
                    <TableCell>{last ? formatDate(last.startsAt, "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          openEdit(patient)
                        }}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">{filtered.length} resultados</span>
          <span className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>
              Anterior
            </Button>
            <span>
              {page + 1} / {pages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page + 1 >= pages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </Button>
          </span>
        </div>
      </div>

      <PatientForm
        open={formOpen}
        title={editing ? "Editar paciente" : "Novo paciente"}
        form={form}
        errors={errors}
        onChange={setForm}
        onOpenChange={setFormOpen}
        onSave={() => void save()}
        saving={saving}
      />

      <Sheet open={Boolean(focused)} onOpenChange={(open) => !open && setFocusId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {focused ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <Portrait seed={focused.name} name={focused.name} />
                  {focused.name}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-8">
                <p className="text-sm text-muted-foreground">
                  {focused.email} · {focused.phone}
                </p>
                <Tabs defaultValue="dados">
                  <TabsList>
                    <TabsTrigger value="dados">Cadastro</TabsTrigger>
                    <TabsTrigger value="consultas">
                      Consultas {focusedAppointments.length > 0 ? `(${focusedAppointments.length})` : ""}
                    </TabsTrigger>
                    <TabsTrigger value="financeiro">
                      Financeiro {focusedPayments.length > 0 ? `(${focusedPayments.length})` : ""}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="dados" className="space-y-3 text-sm pt-2">
                    <div className="rounded-xl border p-3.5 space-y-2 bg-muted/30">
                      <p>
                        <strong className="text-foreground">CPF:</strong> {focused.cpf}
                      </p>
                      <p>
                        <strong className="text-foreground">Nascimento:</strong> {formatDate(focused.birthDate, "dd/MM/yyyy")}
                      </p>
                      <p>
                        <strong className="text-foreground">Endereço:</strong> {focused.address ? `${focused.address}, ${focused.city}` : focused.city || "Não informado"}
                      </p>
                      {focused.notes ? (
                        <p className="text-muted-foreground pt-1 border-t">
                          <strong className="text-foreground">Observações:</strong> {focused.notes}
                        </p>
                      ) : null}
                    </div>
                    <Button type="button" variant="outline" onClick={() => openEdit(focused)}>
                      Editar cadastro
                    </Button>
                  </TabsContent>

                  <TabsContent value="consultas" className="space-y-3 pt-2">
                    {focusedAppointments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-8 text-center bg-muted/10">
                        <Calendar className="mx-auto size-8 text-muted-foreground/60" />
                        <p className="mt-2 text-sm font-medium">Nenhuma consulta cadastrada</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          As consultas agendadas para este paciente aparecerão aqui.
                        </p>
                      </div>
                    ) : (
                      focusedAppointments.map((item) => {
                        const professional = allProfessionals.get(item.professionalId)
                        return (
                          <div key={item.id} className="rounded-2xl bg-muted/60 p-3.5 border transition-colors hover:bg-muted/80">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {formatDate(item.startsAt, "dd/MM/yyyy 'às' HH:mm")}
                              </span>
                              <StatusBadge status={item.status} />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>
                                Profissional: <strong className="font-medium text-foreground">{professional?.name || "Não informado"}</strong>
                              </span>
                              <span className="capitalize">{item.modality}</span>
                            </div>
                            {item.notes ? (
                              <p className="mt-2 text-xs text-muted-foreground border-t pt-2 italic">
                                {item.notes}
                              </p>
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </TabsContent>

                  <TabsContent value="financeiro" className="space-y-3 pt-2">
                    {focusedPayments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-8 text-center bg-muted/10">
                        <Receipt className="mx-auto size-8 text-muted-foreground/60" />
                        <p className="mt-2 text-sm font-medium">Nenhum pagamento registrado</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          As cobranças e recibos emitidos para este paciente aparecerão aqui.
                        </p>
                      </div>
                    ) : (
                      focusedPayments.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3.5 border transition-colors hover:bg-muted/80"
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-foreground">{formatMoney(item.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.description || "Consulta"} · Ref: {item.reference}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(item.createdAt, "dd/MM/yyyy HH:mm")} · Método: <span className="uppercase">{item.method}</span>
                            </p>
                          </div>
                          <PaymentBadge status={item.status} />
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </FadeIn>
  )
}
