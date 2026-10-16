"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { addDays, isSameDay, startOfWeek } from "date-fns"
import { Ban, ChevronLeft, ChevronRight, Plus, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FadeIn } from "@/components/shared/fade-in"
import { Field } from "@/components/shared/field"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { emptyPatientForm, PatientFields, patientFormErrors } from "@/components/desktop/patient-form"
import { formatDate, parseDateKey, timeKey, toDateKey, WEEKDAY_SHORT } from "@/lib/format"
import { availableSlots } from "@/lib/schedule"
import { useDemoStore } from "@/lib/store"
import { SPECIALTIES, SPECIALTY_LABEL, type AgendaView, type Appointment, type PatientInput, type Professional } from "@/lib/types"
import { hasErrors } from "@/lib/validation"

const PX_PER_MIN = 1.1
const DAY_START = 8 * 60
const DAY_END = 18 * 60

export function AgendaView() {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const view = useDemoStore((state) => state.agendaView)
  const setView = useDemoStore((state) => state.setAgendaView)
  const storedDate = useDemoStore((state) => state.agendaDate)
  const setAgendaDate = useDemoStore((state) => state.setAgendaDate)
  const professionalId = useDemoStore((state) => state.agendaProfessionalId)
  const setProfessionalId = useDemoStore((state) => state.setAgendaProfessionalId)
  const specialty = useDemoStore((state) => state.agendaSpecialty)
  const setSpecialty = useDemoStore((state) => state.setAgendaSpecialty)
  const setPatientFocusId = useDemoStore((state) => state.setPatientFocusId)
  const createAppointment = useDemoStore((state) => state.createAppointment)
  const createPatient = useDemoStore((state) => state.createPatient)
  const rescheduleAppointment = useDemoStore((state) => state.rescheduleAppointment)
  const setAppointmentStatus = useDemoStore((state) => state.setAppointmentStatus)
  const cancelAppointment = useDemoStore((state) => state.cancelAppointment)
  const blockSlot = useDemoStore((state) => state.blockSlot)
  const removeBlock = useDemoStore((state) => state.removeBlock)

  const selected = storedDate ? parseDateKey(storedDate) : new Date()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [patientForm, setPatientForm] = useState<PatientInput>(() => emptyPatientForm(data.patients))
  const [patientErrors, setPatientErrors] = useState<Partial<Record<keyof PatientInput, string>>>({})
  const [blockOpen, setBlockOpen] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    patientId: data.currentPatientId,
    professionalId: data.professionals[0]?.id ?? "",
    serviceId: data.professionals[0]?.services[0]?.id ?? "",
    date: toDateKey(selected),
    time: "09:20",
    notes: "",
  })
  const [reschedule, setReschedule] = useState({ date: toDateKey(selected), time: "09:20" })
  const [block, setBlock] = useState({
    professionalId: data.professionals[0]?.id ?? "",
    date: toDateKey(selected),
    start: "11:20",
    end: "12:00",
    reason: "Bloqueio demonstrativo",
  })

  const professionals = data.professionals.filter((item) => {
    if (professionalId !== "all" && item.id !== professionalId) return false
    if (specialty !== "all" && item.specialty !== specialty) return false
    return item.active
  })

  const selectedAppointment = data.appointments.find((item) => item.id === selectedId) ?? null
  const weekStart = startOfWeek(selected, { weekStartsOn: 0 })
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const monthCells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))

  const visibleAppointments = data.appointments.filter((item) => {
    const professional = data.professionals.find((person) => person.id === item.professionalId)
    if (!professional) return false
    if (professionalId !== "all" && item.professionalId !== professionalId) return false
    if (specialty !== "all" && professional.specialty !== specialty) return false
    return true
  })

  const dayAppointments = visibleAppointments
    .filter((item) => isSameDay(new Date(item.startsAt), selected))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  function shift(days: number) {
    const next = addDays(selected, view === "month" ? days * 30 : view === "week" ? days * 7 : days)
    setAgendaDate(toDateKey(next))
  }

  function openCreate(prefill?: { professionalId?: string; date?: string; time?: string }) {
    const professional = data.professionals.find((item) => item.id === (prefill?.professionalId ?? draft.professionalId)) ?? data.professionals[0]
    setDraft({
      patientId: data.currentPatientId,
      professionalId: professional?.id ?? "",
      serviceId: professional?.services[0]?.id ?? "",
      date: prefill?.date ?? toDateKey(selected),
      time: prefill?.time ?? "09:20",
      notes: "",
    })
    setRegistering(false)
    setPatientForm(emptyPatientForm(data.patients))
    setPatientErrors({})
    setCreateOpen(true)
  }

  function saveAppointment() {
    let patientId = draft.patientId
    if (registering) {
      const nextErrors = patientFormErrors(patientForm, data.patients)
      setPatientErrors(nextErrors)
      if (hasErrors(nextErrors)) return
      patientId = createPatient(patientForm)
    }
    const result = createAppointment({ ...draft, patientId })
    if (!result.ok) {
      if (registering) {
        setDraft((current) => ({ ...current, patientId }))
        setRegistering(false)
      }
      toast.error(result.message)
      return
    }
    setCreateOpen(false)
    setRegistering(false)
    setAgendaDate(draft.date)
    toast.success(registering ? "Paciente cadastrado e consulta agendada." : "Agendamento fictício criado.")
  }

  const draftProfessional = data.professionals.find((item) => item.id === draft.professionalId)
  const draftService = draftProfessional?.services.find((item) => item.id === draft.serviceId) ?? draftProfessional?.services[0]
  const createSlots = draftProfessional && draftService
    ? availableSlots({
        professional: draftProfessional,
        service: draftService,
        dateKey: draft.date,
        appointments: data.appointments,
        blockedSlots: data.blockedSlots,
      })
    : []

  const editProfessional = data.professionals.find((item) => item.id === selectedAppointment?.professionalId)
  const editService = editProfessional && selectedAppointment
    ? editProfessional.services.find((item) => item.id === selectedAppointment.serviceId)
    : undefined
  const editSlots = editProfessional && editService && selectedAppointment
    ? availableSlots({
        professional: editProfessional,
        service: editService,
        dateKey: reschedule.date,
        appointments: data.appointments,
        blockedSlots: data.blockedSlots,
        ignoreAppointmentId: selectedAppointment.id,
      })
    : []

  return (
    <FadeIn className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Horários da unidade demonstrativa. Reservas do aplicativo entram aqui automaticamente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setBlockOpen(true)}>
            <Ban /> Bloquear horário
          </Button>
          <Button type="button" onClick={() => openCreate()}>
            <Plus /> Novo agendamento
          </Button>
        </div>
      </div>

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="flex rounded-lg bg-muted p-1">
          {(["day", "week", "month"] as AgendaView[]).map((item) => (
            <button key={item} type="button" onClick={() => setView(item)} className={`rounded-md px-3 py-1.5 text-sm ${view === item ? "bg-white shadow-sm" : "text-muted-foreground"}`}>
              {item === "day" ? "Dia" : item === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Período anterior" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <button type="button" className="min-w-40 text-sm font-medium" onClick={() => setAgendaDate(toDateKey(new Date()))}>
            {view === "month" ? formatDate(selected, "MMMM yyyy") : formatDate(selected, "d 'de' MMMM")}
          </button>
          <Button type="button" variant="ghost" size="icon" aria-label="Próximo período" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
        </div>
        <Select value={professionalId} onValueChange={setProfessionalId}>
          <SelectTrigger className="h-10 w-52" aria-label="Filtrar profissional">
            <SelectValue placeholder="Profissional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os profissionais</SelectItem>
            {data.professionals.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={specialty} onValueChange={(value) => setSpecialty(value as typeof specialty)}>
          <SelectTrigger className="h-10 w-48" aria-label="Filtrar especialidade">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as especialidades</SelectItem>
            {SPECIALTIES.map((item) => (
              <SelectItem key={item} value={item}>{SPECIALTY_LABEL[item]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "month" ? (
        <MonthGrid
          cells={monthCells}
          selected={selected}
          appointments={visibleAppointments}
          onSelect={(date) => {
            setAgendaDate(toDateKey(date))
            setView("day")
          }}
        />
      ) : (
        <TimeGrid
          days={view === "week" ? weekDays : [selected]}
          professionals={view === "day" ? professionals : []}
          appointments={visibleAppointments}
          blocks={data.blockedSlots.filter((item) => professionalId === "all" || item.professionalId === professionalId)}
          mode={view === "day" ? "professionals" : "days"}
          roster={data.professionals}
          onSelectAppointment={setSelectedId}
          onCreateSlot={(nextProfessional, date, time) => openCreate({ professionalId: nextProfessional, date, time })}
          onRemoveBlock={(id) => {
            removeBlock(id)
            toast.success("Bloqueio removido.")
          }}
        />
      )}

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">Compromissos de {formatDate(selected, "d 'de' MMMM")}</h2>
        <div className="mt-4 divide-y">
          {dayAppointments.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nenhum agendamento neste dia com os filtros atuais.</p> : null}
          {dayAppointments.map((item) => {
            const patient = data.patients.find((person) => person.id === item.patientId)
            const professional = data.professionals.find((person) => person.id === item.professionalId)
            return (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="flex w-full items-center gap-4 py-3 text-left hover:bg-muted/40">
                <span className="w-14 text-sm font-medium">{formatDate(item.startsAt, "HH:mm")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{patient?.name}</span>
                  <span className="block text-xs text-muted-foreground">{professional?.name}</span>
                </span>
                <StatusBadge status={item.status} />
              </button>
            )
          })}
        </div>
      </section>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setRegistering(false) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
            <DialogDescription>Escolha um paciente já cadastrado ou registre um cadastro fictício antes de confirmar a consulta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {registering ? (
              <div className="rounded-2xl bg-muted/60 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Novo paciente</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRegistering(false)}>Usar cadastro existente</Button>
                </div>
                <PatientFields idPrefix="agenda-new" form={patientForm} errors={patientErrors} onChange={setPatientForm} />
              </div>
            ) : (
              <Field label="Paciente" htmlFor="agenda-patient">
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Select value={draft.patientId} onValueChange={(value) => setDraft((current) => ({ ...current, patientId: value }))}>
                      <SelectTrigger id="agenda-patient" className="h-10 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {data.patients.filter((item) => item.status === "active").map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPatientForm(emptyPatientForm(data.patients))
                      setPatientErrors({})
                      setRegistering(true)
                    }}
                  >
                    <UserPlus /> Cadastrar
                  </Button>
                </div>
              </Field>
            )}
            <Field label="Profissional">
              <Select
                value={draft.professionalId}
                onValueChange={(value) => {
                  const professional = data.professionals.find((item) => item.id === value)
                  setDraft((current) => ({ ...current, professionalId: value, serviceId: professional?.services[0]?.id ?? "" }))
                }}
              >
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {data.professionals.filter((item) => item.active).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Serviço">
              <Select value={draft.serviceId} onValueChange={(value) => setDraft((current) => ({ ...current, serviceId: value }))}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(draftProfessional?.services ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data" htmlFor="agenda-date">
              <Input id="agenda-date" type="date" className="h-10" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
            </Field>
            <Field label="Horário disponível" hint={createSlots.length === 0 ? "Não há horário livre nessa data." : undefined}>
              <div className="flex flex-wrap gap-2">
                {createSlots.map((slot) => (
                  <button key={slot.time} type="button" onClick={() => setDraft((current) => ({ ...current, time: slot.time }))} className={`rounded-full px-3 py-1 text-sm ring-1 ${draft.time === slot.time ? "bg-primary text-primary-foreground ring-primary" : "ring-border"}`}>
                    {slot.time}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Observação" htmlFor="agenda-notes">
              <Textarea id="agenda-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Observação administrativa da demonstração" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" onClick={saveAppointment}>
              {registering ? "Cadastrar e agendar" : "Salvar agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedAppointment)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {selectedAppointment ? (
            <AppointmentDetails
              appointment={selectedAppointment}
              reschedule={reschedule}
              slots={editSlots}
              onRescheduleChange={setReschedule}
              onConfirm={() => {
                setAppointmentStatus(selectedAppointment.id, "confirmed")
                toast.success("Presença confirmada na demonstração.")
              }}
              onComplete={() => {
                setAppointmentStatus(selectedAppointment.id, "completed")
                toast.success("Consulta marcada como realizada.")
              }}
              onSaveReschedule={() => {
                const result = rescheduleAppointment(selectedAppointment.id, reschedule.date, reschedule.time)
                if (!result.ok) {
                  toast.error(result.message)
                  return
                }
                toast.success("Consulta reagendada.")
                setSelectedId(null)
              }}
              onCancel={() => setCancelId(selectedAppointment.id)}
              onOpenPatient={() => {
                setPatientFocusId(selectedAppointment.patientId)
                setSelectedId(null)
                router.push("/desktop/pacientes")
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear horário</DialogTitle>
            <DialogDescription>O intervalo fica indisponível para novos agendamentos desta demonstração.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Profissional">
              <Select value={block.professionalId} onValueChange={(value) => setBlock((current) => ({ ...current, professionalId: value }))}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {data.professionals.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data" htmlFor="block-date">
              <Input id="block-date" type="date" className="h-10" value={block.date} onChange={(event) => setBlock((current) => ({ ...current, date: event.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início" htmlFor="block-start">
                <Input id="block-start" type="time" className="h-10" value={block.start} onChange={(event) => setBlock((current) => ({ ...current, start: event.target.value }))} />
              </Field>
              <Field label="Fim" htmlFor="block-end">
                <Input id="block-end" type="time" className="h-10" value={block.end} onChange={(event) => setBlock((current) => ({ ...current, end: event.target.value }))} />
              </Field>
            </div>
            <Field label="Motivo" htmlFor="block-reason">
              <Input id="block-reason" className="h-10" value={block.reason} onChange={(event) => setBlock((current) => ({ ...current, reason: event.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                const result = blockSlot(block)
                if (!result.ok) {
                  toast.error(result.message)
                  return
                }
                setBlockOpen(false)
                toast.success("Horário bloqueado.")
              }}
            >
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(cancelId)}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancelar consulta?"
        description="O horário volta a ficar disponível. Se havia pagamento simulado recebido, ele aparece como estorno demonstrativo."
        confirmLabel="Cancelar consulta"
        destructive
        onConfirm={() => {
          if (!cancelId) return
          cancelAppointment(cancelId)
          setCancelId(null)
          setSelectedId(null)
          toast.success("Consulta cancelada na demonstração.")
        }}
      />
    </FadeIn>
  )
}

function AppointmentDetails({
  appointment,
  reschedule,
  slots,
  onRescheduleChange,
  onConfirm,
  onComplete,
  onSaveReschedule,
  onCancel,
  onOpenPatient,
}: {
  appointment: Appointment
  reschedule: { date: string; time: string }
  slots: Array<{ time: string }>
  onRescheduleChange: (value: { date: string; time: string }) => void
  onConfirm: () => void
  onComplete: () => void
  onSaveReschedule: () => void
  onCancel: () => void
  onOpenPatient: () => void
}) {
  const data = useDemoStore((state) => state.data)
  const patient = data.patients.find((item) => item.id === appointment.patientId)
  const professional = data.professionals.find((item) => item.id === appointment.professionalId)
  const closed = appointment.status === "cancelled" || appointment.status === "completed"

  return (
    <>
      <DialogHeader>
        <DialogTitle>{patient?.name}</DialogTitle>
        <DialogDescription>
          {professional?.name} · {formatDate(appointment.startsAt, "EEEE, d 'de' MMMM 'às' HH:mm")}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <StatusBadge status={appointment.status} />
        <p className="text-muted-foreground">{appointment.notes}</p>
        <p className="text-xs text-muted-foreground">Origem: {appointment.origin === "mobile" ? "aplicativo do paciente" : appointment.origin === "desktop" ? "painel" : "roteiro inicial"}.</p>
      </div>
      {closed ? null : (
        <div className="grid gap-3">
          <Field label="Nova data" htmlFor="reschedule-date">
            <Input id="reschedule-date" type="date" className="h-10" value={reschedule.date} onChange={(event) => onRescheduleChange({ ...reschedule, date: event.target.value })} />
          </Field>
          <Field label="Novo horário">
            <div className="flex flex-wrap gap-2">
              {slots.length === 0 ? <p className="text-xs text-muted-foreground">Sem horários livres nessa data.</p> : null}
              {slots.map((slot) => (
                <button key={slot.time} type="button" onClick={() => onRescheduleChange({ ...reschedule, time: slot.time })} className={`rounded-full px-3 py-1 text-sm ring-1 ${reschedule.time === slot.time ? "bg-primary text-primary-foreground ring-primary" : "ring-border"}`}>
                  {slot.time}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}
      <DialogFooter className="flex-wrap">
        <Button type="button" variant="outline" onClick={onOpenPatient}>Abrir ficha</Button>
        {appointment.status === "scheduled" ? <Button type="button" variant="outline" onClick={onConfirm}>Confirmar presença</Button> : null}
        {appointment.status !== "cancelled" && appointment.status !== "completed" ? <Button type="button" variant="outline" onClick={onComplete}>Marcar realizada</Button> : null}
        {closed ? null : <Button type="button" onClick={onSaveReschedule}>Reagendar</Button>}
        {appointment.status === "cancelled" ? null : <Button type="button" variant="destructive" onClick={onCancel}>Cancelar</Button>}
      </DialogFooter>
    </>
  )
}

function TimeGrid({
  days,
  professionals,
  appointments,
  blocks,
  mode,
  roster,
  onSelectAppointment,
  onCreateSlot,
  onRemoveBlock,
}: {
  days: Date[]
  professionals: Professional[]
  appointments: Appointment[]
  blocks: Array<{ id: string; professionalId: string; startsAt: string; endsAt: string; reason: string }>
  mode: "days" | "professionals"
  roster: Professional[]
  onSelectAppointment: (id: string) => void
  onCreateSlot: (professionalId: string, date: string, time: string) => void
  onRemoveBlock: (id: string) => void
}) {
  const patients = useDemoStore((state) => state.data.patients)
  const columns = mode === "days"
    ? days.map((day) => ({ key: toDateKey(day), title: WEEKDAY_SHORT[day.getDay()] ?? "", subtitle: formatDate(day, "d"), date: day, professionalId: undefined as string | undefined }))
    : professionals.map((professional) => ({ key: professional.id, title: professional.name.replace(/^Dra?\.\s+/i, "").split(" ")[0] ?? professional.name, subtitle: SPECIALTY_LABEL[professional.specialty], date: days[0] ?? new Date(), professionalId: professional.id }))
  const height = (DAY_END - DAY_START) * PX_PER_MIN

  return (
    <div className="panel overflow-x-auto p-3">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `64px repeat(${Math.max(columns.length, 1)}, minmax(120px, 1fr))` }}>
        <div />
        {columns.map((column) => (
          <div key={column.key} className="px-2 pb-3 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{column.title}</p>
            <p className="text-sm font-medium">{column.subtitle}</p>
          </div>
        ))}
        <div className="relative" style={{ height }}>
          {Array.from({ length: 11 }, (_, index) => (
            <span key={index} className="absolute right-2 text-[11px] text-muted-foreground" style={{ top: index * 60 * PX_PER_MIN - 6 }}>
              {String(8 + index).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {columns.map((column) => {
          const columnAppointments = appointments.filter((item) => {
            if (!isSameDay(new Date(item.startsAt), column.date)) return false
            if (column.professionalId && item.professionalId !== column.professionalId) return false
            return true
          })
          const columnBlocks = blocks.filter((item) => {
            if (!isSameDay(new Date(item.startsAt), column.date)) return false
            if (column.professionalId && item.professionalId !== column.professionalId) return false
            return true
          })
          return (
            <div key={column.key} className="relative border-l border-border" style={{ height }}>
              {Array.from({ length: 10 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className="absolute inset-x-0 border-t border-dashed border-border/80"
                  style={{ top: index * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                  aria-label={`Criar às ${8 + index}:00`}
                  onClick={() => {
                    const professionalId = column.professionalId ?? professionals[0]?.id ?? roster[0]?.id
                    if (!professionalId) return
                    onCreateSlot(professionalId, toDateKey(column.date), `${String(8 + index).padStart(2, "0")}:00`)
                  }}
                />
              ))}
              {columnBlocks.map((block) => {
                const start = new Date(block.startsAt)
                const end = new Date(block.endsAt)
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => onRemoveBlock(block.id)}
                    className="absolute inset-x-1 z-10 overflow-hidden rounded-lg bg-[repeating-linear-gradient(135deg,#e8eef0,#e8eef0_6px,#f7fafb_6px,#f7fafb_12px)] px-2 py-1 text-left text-[11px] text-muted-foreground ring-1 ring-border"
                    style={boxStyle(start, end)}
                  >
                    {block.reason}
                  </button>
                )
              })}
              {columnAppointments.map((item) => {
                const professional = roster.find((person) => person.id === item.professionalId)
                const patient = patients.find((person) => person.id === item.patientId)
                const color = colorFor(item.professionalId, roster)
                const label = mode === "professionals" ? patient?.name : `${patient?.name ?? "Paciente"} · ${professional?.name.replace(/^Dra?\.\s+/i, "").split(" ")[0] ?? ""}`
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectAppointment(item.id)}
                    className="absolute inset-x-1 z-20 overflow-hidden rounded-lg px-2 py-1 text-left text-[11px] text-white shadow-sm"
                    style={{ ...boxStyle(new Date(item.startsAt), new Date(item.endsAt)), background: item.status === "cancelled" ? "#94a3b8" : color, opacity: item.status === "cancelled" ? 0.55 : 1 }}
                  >
                    <span className="block font-medium">{timeKey(new Date(item.startsAt))}</span>
                    <span className="block truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function boxStyle(start: Date, end: Date) {
  const startMin = start.getHours() * 60 + start.getMinutes()
  const endMin = end.getHours() * 60 + end.getMinutes()
  return {
    top: (startMin - DAY_START) * PX_PER_MIN,
    height: Math.max(26, (endMin - startMin) * PX_PER_MIN - 2),
  }
}

const COLORS = ["#0d3b4c", "#127e7a", "#8a5a44", "#1d6f8a", "#3f6b4e", "#6d5a8e", "#a15c38", "#3d5a80"]

function colorFor(id: string, roster: Professional[]) {
  const index = Math.max(0, roster.findIndex((item) => item.id === id))
  return COLORS[index % COLORS.length]
}

function MonthGrid({
  cells,
  selected,
  appointments,
  onSelect,
}: {
  cells: Date[]
  selected: Date
  appointments: Appointment[]
  onSelect: (date: Date) => void
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of appointments) {
      if (item.status === "cancelled") continue
      const key = toDateKey(new Date(item.startsAt))
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [appointments])

  return (
    <div className="panel p-4">
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
        {WEEKDAY_SHORT.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((date) => {
          const key = toDateKey(date)
          const count = counts.get(key) ?? 0
          const inMonth = date.getMonth() === selected.getMonth()
          const isSelected = isSameDay(date, selected)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(date)}
              className={`min-h-20 rounded-2xl p-2 text-left ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted/50"} ${inMonth ? "" : "opacity-40"}`}
            >
              <span className="text-sm font-medium">{date.getDate()}</span>
              {count > 0 ? <span className={`mt-2 block text-xs ${isSelected ? "text-white/80" : "text-teal"}`}>{count} consulta{count > 1 ? "s" : ""}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
