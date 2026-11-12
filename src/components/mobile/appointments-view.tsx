"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { isBefore } from "date-fns"
import { Building2, CheckCircle2, Clock, MapPin } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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
  const [serverPayments, setServerPayments] = useState<
    (Payment & { invoiceUrl?: string; pixPayload?: string; bankSlipUrl?: string | null; identificationField?: string | null })[]
  >([])
  const sessionPatientId = useDemoStore((state) => state.mobileSessionPatientId)

  useEffect(() => {
    let active = true
    fetch("/api/mobile/appointments", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as {
          appointments?: Appointment[]
          payments?: (Payment & {
            invoiceUrl?: string
            pixPayload?: string
            bankSlipUrl?: string | null
            identificationField?: string | null
          })[]
        }
        if (active && Array.isArray(body.appointments)) {
          setServerAppointments(body.appointments)
          if (Array.isArray(body.payments)) setServerPayments(body.payments)
        }
      })
      .catch(() => {})
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
  const upcoming = mine.filter(
    (item) => (item.status === "scheduled" || item.status === "confirmed") && !isBefore(new Date(item.startsAt), now)
  )
  const previous = mine.filter(
    (item) =>
      item.status === "completed" ||
      item.status === "no-show" ||
      ((item.status === "scheduled" || item.status === "confirmed") && isBefore(new Date(item.startsAt), now))
  )
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
      <h1 className="mt-1 text-2xl font-semibold">Consultas & Exames</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {upcoming.length} {upcoming.length === 1 ? "próxima" : "próximas"} · {previous.length} anteriores
      </p>

      {!sessionPatientId && serverAppointments.length === 0 && (
        <div className="mt-3 rounded-2xl border border-teal/30 bg-teal/5 p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 text-teal font-semibold">
            <Building2 className="size-4" />
            <span>Já agendou na clínica ou recepção?</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Acesse com seu CPF para sincronizar e acompanhar os agendamentos e exames marcados pelo computador ou recepção.
          </p>
          <Button asChild size="sm" className="w-full bg-teal text-white hover:bg-teal/90 h-9">
            <Link href="/mobile/perfil">Entrar com meu CPF</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="proximas" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="proximas">Próximas</TabsTrigger>
          <TabsTrigger value="anteriores">Anteriores</TabsTrigger>
          <TabsTrigger value="canceladas">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="proximas">
          <List items={upcoming} empty="Nenhuma consulta futura." serverPayments={serverPayments} onOpen={setSelectedId} />
        </TabsContent>
        <TabsContent value="anteriores">
          <List items={previous} empty="Nenhuma consulta anterior." serverPayments={serverPayments} onOpen={setSelectedId} />
        </TabsContent>
        <TabsContent value="canceladas">
          <List items={cancelled} empty="Nenhuma consulta cancelada." serverPayments={serverPayments} onOpen={setSelectedId} />
        </TabsContent>
      </Tabs>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          {selected ? (
            <Details
              appointment={selected}
              serverPayments={serverPayments}
              onReschedule={() => reschedule(selected)}
              onCancel={() => setCancelId(selected.id)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={Boolean(cancelId)}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancelar esta consulta?"
        description="O horário volta a ficar livre para agendamento. Para pagamentos já confirmados, entre em contato com a clínica para avaliar o estorno."
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
          toast.success("Consulta cancelada. O horário foi liberado.")
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

function List({
  items,
  empty,
  serverPayments,
  onOpen,
}: {
  items: Appointment[]
  empty: string
  serverPayments: (Payment & { invoiceUrl?: string; pixPayload?: string; bankSlipUrl?: string | null; identificationField?: string | null })[]
  onOpen: (id: string) => void
}) {
  const data = useDemoStore((state) => state.data)
  if (items.length === 0)
    return <p className="mt-3 rounded-2xl bg-white px-4 py-6 text-sm text-muted-foreground ring-1 ring-border">{empty}</p>

  return (
    <div className="mt-3 space-y-3">
      {items
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .map((item) => {
          const professional = data.professionals.find((person) => person.id === item.professionalId)
          const service = professional?.services.find((entry) => entry.id === item.serviceId)

          const providerName =
            item.professionalName || professional?.name || item.clinicName || "Clínica Geral (Exame)"
          const serviceName = item.serviceName || service?.name || "Procedimento / Consulta"

          const payment: Payment & { bankSlipUrl?: string | null; identificationField?: string | null } | undefined =
            serverPayments.find(
              (p) => (p.appointmentId && p.appointmentId === item.id) || p.id === item.paymentId
            ) ??
            data.payments.find(
              (p) => (p.appointmentId && p.appointmentId === item.id) || p.id === item.paymentId
            )

          const isPaid = payment?.status === "paid" || item.status === "confirmed"
          const isCancelled = item.status === "cancelled"

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className="surface-card block w-full p-4 text-left transition hover:border-teal/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-foreground text-base block">{providerName}</span>
                  <span className="text-xs text-muted-foreground block">{serviceName}</span>
                  {item.clinicName && item.clinicName !== providerName ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      <Building2 className="size-3" /> {item.clinicName}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="size-3.5" /> Pago e confirmado
                    </span>
                  ) : isCancelled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                      Cancelada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      <Clock className="size-3.5" /> Aguardando pagamento
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
                <span>{formatDate(item.startsAt, "EEEE, d 'de' MMMM 'às' HH:mm")}</span>
                {!isPaid && !isCancelled ? <span className="font-medium text-teal">Ver cobrança →</span> : null}
              </div>
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
  serverPayments: (Payment & { invoiceUrl?: string; pixPayload?: string; bankSlipUrl?: string | null; identificationField?: string | null })[]
  onReschedule: () => void
  onCancel: () => void
}) {
  const data = useDemoStore((state) => state.data)
  const professional = data.professionals.find((item) => item.id === appointment.professionalId)
  const service = professional?.services.find((entry) => entry.id === appointment.serviceId)

  const providerName =
    appointment.professionalName || professional?.name || appointment.clinicName || "Clínica Geral (Exame)"
  const serviceName = appointment.serviceName || service?.name || "Procedimento / Consulta"

  const payment: Payment & { bankSlipUrl?: string | null; identificationField?: string | null } | undefined =
    serverPayments.find(
      (item) => (item.appointmentId && item.appointmentId === appointment.id) || item.id === appointment.paymentId
    ) ??
    data.payments.find(
      (item) => (item.appointmentId && item.appointmentId === appointment.id) || item.id === appointment.paymentId
    )

  const isPaid = payment?.status === "paid" || appointment.status === "confirmed"
  const isCancelled = appointment.status === "cancelled"
  const isPending = !isPaid && !isCancelled
  const canChange = appointment.status === "scheduled" || appointment.status === "confirmed"

  return (
    <>
      <SheetHeader>
        <SheetTitle>{providerName}</SheetTitle>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-6 text-sm">
        <div>
          <p className="font-medium text-foreground">{serviceName}</p>
          <p className="text-muted-foreground">{formatDate(appointment.startsAt, "EEEE, d 'de' MMMM 'às' HH:mm")}</p>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">Modalidade: {appointment.modality}</p>
          {appointment.clinicName ? (
            <p className="mt-1 text-xs text-teal font-medium flex items-center gap-1.5">
              <Building2 className="size-3.5 shrink-0" />
              <span>Local: {appointment.clinicName}</span>
              {appointment.clinicAddress ? (
                <span className="text-muted-foreground">({appointment.clinicAddress})</span>
              ) : null}
            </p>
          ) : null}
        </div>

        {/* Destaque do Pagamento */}
        <div
          className={`rounded-2xl p-4 border ${
            isPaid
              ? "bg-emerald-50/70 border-emerald-200"
              : isCancelled
                ? "bg-muted border-border"
                : "bg-amber-50/70 border-amber-200"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Situação do Pagamento
            </span>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 text-xs">
                <CheckCircle2 className="size-3.5" /> Pago e confirmado
              </span>
            ) : isCancelled ? (
              <span className="text-xs font-medium text-muted-foreground">Cancelado</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-800 text-xs">
                <Clock className="size-3.5" /> Aguardando pagamento
              </span>
            )}
          </div>
          {payment ? (
            <div className="mt-2 space-y-1">
              <p className="text-lg font-bold text-foreground">{formatMoney(payment.amount)}</p>
              <p className="text-xs text-muted-foreground">
                Ref: {payment.reference} ·{" "}
                {payment.method === "pix" ? "Pix" : payment.method === "boleto" ? "Boleto" : "Cartão"}
              </p>
              {payment.method === "boleto" && payment.identificationField ? (
                <p className="break-all font-mono text-[11px] text-muted-foreground">{payment.identificationField}</p>
              ) : null}
              {payment.paidAt ? (
                <p className="text-xs text-emerald-700">Pago em {formatDate(payment.paidAt, "dd/MM/yyyy 'às' HH:mm")}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Nenhuma cobrança registrada.</p>
          )}
        </div>

        {isPending && (payment?.invoiceUrl || payment?.bankSlipUrl) ? (
          <Button asChild className="w-full h-11 bg-teal text-white hover:bg-teal/90">
            <a href={payment.bankSlipUrl || payment.invoiceUrl} target="_blank" rel="noreferrer">
              Pagar agora no Asaas
            </a>
          </Button>
        ) : null}

        {payment?.method === "boleto" && isPending && payment?.identificationField ? (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-medium">Linha digitável</p>
            <p className="mt-1 break-all font-mono">{payment.identificationField}</p>
            <p className="mt-2">
              O boleto pode levar até 3 dias úteis para compensar. A consulta continua pendente até a confirmação.
            </p>
          </div>
        ) : null}

        {appointment.notes ? (
          <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border">{appointment.notes}</p>
        ) : null}

        {canChange ? (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onReschedule}>
              Reagendar
            </Button>
            <Button type="button" variant="destructive" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )
}
