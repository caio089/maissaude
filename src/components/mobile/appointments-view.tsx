"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { isBefore } from "date-fns"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { Appointment, Payment } from "@/lib/types"

export function MobileAppointments() {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const cancelAppointment = useDemoStore((state) => state.cancelAppointment)
  const patchBooking = useDemoStore((state) => state.patchBooking)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [serverAppointments, setServerAppointments] = useState<Appointment[]>([])
  const [serverPayments, setServerPayments] = useState<Payment[]>([])
  const sessionPatientId = useDemoStore((state) => state.mobileSessionPatientId)

  useEffect(() => {
    let active = true
    fetch("/api/mobile/appointments", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as { appointments?: Appointment[]; payments?: Payment[] }
        if (active && Array.isArray(body.appointments)) {
          setServerAppointments(body.appointments)
          if (Array.isArray(body.payments)) setServerPayments(body.payments)
        }
      })
      .catch(() => {
        // Fallback limpo: mantém os dados locais do useDemoStore
      })
    return () => {
      active = false
    }
  }, [])

  const mine = useMemo(() => {
    const map = new Map<string, Appointment>()
    for (const item of data.appointments.filter((item) => item.patientId === sessionPatientId)) {
      map.set(item.id, item)
    }
    for (const item of serverAppointments) {
      map.set(item.id, item)
    }
    return [...map.values()]
  }, [data.appointments, sessionPatientId, serverAppointments])

  const now = new Date()
  const upcoming = mine.filter((item) => (item.status === "scheduled" || item.status === "confirmed") && !isBefore(new Date(item.startsAt), now))
  const previous = mine.filter((item) => item.status === "completed" || item.status === "no-show" || ((item.status === "scheduled" || item.status === "confirmed") && isBefore(new Date(item.startsAt), now)))
  const cancelled = mine.filter((item) => item.status === "cancelled")
  const selected = mine.find((item) => item.id === selectedId) ?? null

  function reschedule(appointment: Appointment) {
    patchBooking({
      professionalId: appointment.professionalId,
      serviceId: appointment.serviceId,
      date: null,
      time: null,
      rescheduleAppointmentId: appointment.id,
    })
    setSelectedId(null)
    router.push("/mobile/agendamento")
  }

  return (
    <div className="px-4 pt-5 pb-6">
      <p className="section-kicker">Sua agenda</p>
      <h1 className="mt-1 text-2xl font-semibold">Consultas</h1>
      <p className="mt-1 text-sm text-muted-foreground">{upcoming.length} {upcoming.length === 1 ? "próxima" : "próximas"} · {previous.length} anteriores</p>
      <Tabs defaultValue="proximas" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="proximas">Próximas</TabsTrigger>
          <TabsTrigger value="anteriores">Anteriores</TabsTrigger>
          <TabsTrigger value="canceladas">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="proximas"><List items={upcoming} empty="Nenhuma consulta futura." onOpen={setSelectedId} /></TabsContent>
        <TabsContent value="anteriores"><List items={previous} empty="Nenhuma consulta anterior." onOpen={setSelectedId} /></TabsContent>
        <TabsContent value="canceladas"><List items={cancelled} empty="Nenhuma consulta cancelada." onOpen={setSelectedId} /></TabsContent>
      </Tabs>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {selected ? <Details appointment={selected} serverPayments={serverPayments} onReschedule={() => reschedule(selected)} onCancel={() => setCancelId(selected.id)} /> : null}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={Boolean(cancelId)}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancelar esta consulta?"
        description="O horário volta a ficar disponível. Para pagamentos já confirmados, entre em contato com a clínica para avaliar o estorno."
        confirmLabel="Cancelar consulta"
        destructive
        onConfirm={async () => {
          if (!cancelId) return
          const idToCancel = cancelId
          cancelAppointment(idToCancel, "patient")
          setServerAppointments((prev) =>
            prev.map((item) => (item.id === idToCancel ? { ...item, status: "cancelled" } : item))
          )
          setCancelId(null)
          setSelectedId(null)
          toast.success("Consulta cancelada.")
          try {
            await fetch("/api/mobile/appointments", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appointmentId: idToCancel }),
            })
          } catch {
            // Continua cancelado localmente
          }
        }}
      />
    </div>
  )
}

function List({ items, empty, onOpen }: { items: Appointment[]; empty: string; onOpen: (id: string) => void }) {
  const data = useDemoStore((state) => state.data)
  if (items.length === 0) return <p className="mt-3 rounded-2xl bg-white px-4 py-6 text-sm text-muted-foreground ring-1 ring-border">{empty}</p>
  return (
    <div className="mt-3 space-y-3">
      {items
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .map((item) => {
          const professional = data.professionals.find((person) => person.id === item.professionalId)
          const service = professional?.services.find((entry) => entry.id === item.serviceId)
          return (
            <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="surface-card block w-full p-4 text-left">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{professional?.name}</span>
                <StatusBadge status={item.status} />
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{service?.name ?? "Consulta"}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{formatDate(item.startsAt, "EEEE, d 'de' MMMM 'às' HH:mm")}</span>
            </button>
          )
        })}
    </div>
  )
}

function Details({
  appointment,
  serverPayments,
  onReschedule,
  onCancel,
}: {
  appointment: Appointment
  serverPayments: Payment[]
  onReschedule: () => void
  onCancel: () => void
}) {
  const data = useDemoStore((state) => state.data)
  const professional = data.professionals.find((item) => item.id === appointment.professionalId)
  const payment =
    serverPayments.find((item) => item.id === appointment.paymentId) ??
    data.payments.find((item) => item.id === appointment.paymentId)
  const canChange = appointment.status === "scheduled" || appointment.status === "confirmed"
  return (
    <>
      <SheetHeader><SheetTitle>{professional?.name}</SheetTitle></SheetHeader>
      <div className="space-y-4 px-4 pb-6 text-sm">
        <p>{formatDate(appointment.startsAt, "EEEE, d 'de' MMMM 'às' HH:mm")}</p>
        <StatusBadge status={appointment.status} />
        <p className="text-muted-foreground">{appointment.notes}</p>
        {payment ? (
          <div className="relative overflow-hidden rounded-2xl bg-muted p-4">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary/50">COBRANÇA</p>
            <p className="mt-2 font-medium">{payment.reference}</p>
            <p>{formatMoney(payment.amount)} · {payment.method === "pix" ? "Pix" : "Cartão"}</p>
          </div>
        ) : null}
        {canChange ? (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={onReschedule}>Reagendar</Button>
            <Button type="button" variant="destructive" onClick={onCancel}>Cancelar</Button>
          </div>
        ) : null}
      </div>
    </>
  )
}
