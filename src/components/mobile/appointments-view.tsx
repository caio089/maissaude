"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { isBefore } from "date-fns"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { Appointment } from "@/lib/types"

export function MobileAppointments() {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const cancelAppointment = useDemoStore((state) => state.cancelAppointment)
  const patchBooking = useDemoStore((state) => state.patchBooking)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const mine = data.appointments.filter((item) => item.patientId === data.currentPatientId)
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
    <div className="px-5 pt-5 pb-6">
      <h1 className="text-2xl font-semibold">Consultas</h1>
      <Tabs defaultValue="proximas" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="proximas">Próximas</TabsTrigger>
          <TabsTrigger value="anteriores">Anteriores</TabsTrigger>
          <TabsTrigger value="canceladas">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="proximas"><List items={upcoming} empty="Nenhuma consulta futura." onOpen={setSelectedId} /></TabsContent>
        <TabsContent value="anteriores"><List items={previous} empty="Nenhuma consulta anterior no roteiro." onOpen={setSelectedId} /></TabsContent>
        <TabsContent value="canceladas"><List items={cancelled} empty="Nenhuma consulta cancelada." onOpen={setSelectedId} /></TabsContent>
      </Tabs>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {selected ? <Details appointment={selected} onReschedule={() => reschedule(selected)} onCancel={() => setCancelId(selected.id)} /> : null}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={Boolean(cancelId)}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancelar esta consulta?"
        description="O cancelamento é simulado. O horário volta a ficar disponível e um pagamento recebido aparece como estorno demonstrativo."
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
    </div>
  )
}

function List({ items, empty, onOpen }: { items: Appointment[]; empty: string; onOpen: (id: string) => void }) {
  const data = useDemoStore((state) => state.data)
  if (items.length === 0) return <p className="px-1 py-8 text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="mt-3 space-y-3">
      {items
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .map((item) => {
          const professional = data.professionals.find((person) => person.id === item.professionalId)
          return (
            <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="block w-full rounded-3xl bg-white p-4 text-left ring-1 ring-border">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{professional?.name}</span>
                <StatusBadge status={item.status} />
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{formatDate(item.startsAt, "EEEE, d 'de' MMMM 'às' HH:mm")}</span>
            </button>
          )
        })}
    </div>
  )
}

function Details({ appointment, onReschedule, onCancel }: { appointment: Appointment; onReschedule: () => void; onCancel: () => void }) {
  const data = useDemoStore((state) => state.data)
  const professional = data.professionals.find((item) => item.id === appointment.professionalId)
  const payment = data.payments.find((item) => item.id === appointment.paymentId)
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
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary/50">COMPROVANTE DEMONSTRATIVO</p>
            <p className="mt-2 font-medium">{payment.reference}</p>
            <p>{formatMoney(payment.amount)} · {payment.method === "pix" ? "Pix simulado" : "Cartão simulado"}</p>
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
