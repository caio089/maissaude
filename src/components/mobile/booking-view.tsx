"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { addDays } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { formatDate, formatMoney, toDateKey, WEEKDAY_SHORT } from "@/lib/format"
import { availableSlots } from "@/lib/schedule"
import { useDemoStore } from "@/lib/store"

const STEPS = ["Profissional", "Serviço", "Data", "Horário", "Revisão"]

export function BookingView() {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const booking = useDemoStore((state) => state.booking)
  const patchBooking = useDemoStore((state) => state.patchBooking)
  const confirmReschedule = useDemoStore((state) => state.confirmReschedule)
  const now = useMemo(() => new Date(), [])
  const initial = !booking.professionalId ? 0 : !booking.serviceId ? 1 : !booking.date ? 2 : !booking.time ? 3 : 4
  const [step, setStep] = useState(initial)
  const previousProfessional = useRef(booking.professionalId)

  useEffect(() => {
    if (previousProfessional.current === booking.professionalId && !booking.rescheduleAppointmentId) return
    const professionalChanged = previousProfessional.current !== booking.professionalId
    previousProfessional.current = booking.professionalId
    if (!professionalChanged && !booking.rescheduleAppointmentId) return
    queueMicrotask(() => {
      if (!booking.professionalId) setStep(0)
      else if (booking.rescheduleAppointmentId) setStep(2)
      else setStep(1)
    })
  }, [booking.professionalId, booking.rescheduleAppointmentId])
  const professional = data.professionals.find((item) => item.id === booking.professionalId)
  const service = professional?.services.find((item) => item.id === booking.serviceId)
  const days = Array.from({ length: 14 }, (_, index) => addDays(now, index))
  const slots = professional && service && booking.date
    ? availableSlots({
        professional,
        service,
        dateKey: booking.date,
        appointments: data.appointments,
        blockedSlots: data.blockedSlots,
        now,
        ignoreAppointmentId: booking.rescheduleAppointmentId ?? undefined,
      })
    : []

  function next() {
    if (step === 0 && !booking.professionalId) return toast.error("Selecione um profissional.")
    if (step === 1 && !booking.serviceId) return toast.error("Selecione um serviço.")
    if (step === 2 && !booking.date) return toast.error("Selecione uma data.")
    if (step === 3 && !booking.time) return toast.error("Selecione um horário livre.")
    setStep((current) => Math.min(4, current + 1))
  }

  return (
    <div className="px-5 pt-5 pb-6">
      <p className="text-xs font-medium uppercase tracking-wide text-teal">{booking.rescheduleAppointmentId ? "Reagendamento" : "Novo horário"}</p>
      <h1 className="mt-1 text-2xl font-semibold">Agendar consulta</h1>
      <ol className="mt-4 flex gap-1">
        {STEPS.map((label, index) => (
          <li key={label} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-teal" : "bg-border"}`} />
        ))}
      </ol>
      <p className="mt-2 text-sm text-muted-foreground">{STEPS[step]}</p>

      <div className="mt-4 space-y-3">
        {step === 0 ? data.professionals.filter((item) => item.active).map((item) => (
          <button key={item.id} type="button" onClick={() => patchBooking({ professionalId: item.id, serviceId: null, date: null, time: null })} className={`block w-full rounded-2xl px-4 py-3 text-left ${booking.professionalId === item.id ? "bg-accent ring-1 ring-teal" : "bg-white ring-1 ring-border"}`}>
            <span className="block text-sm font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">{formatMoney(item.price)}</span>
          </button>
        )) : null}

        {step === 1 ? (professional?.services ?? []).map((item) => (
          <button key={item.id} type="button" onClick={() => patchBooking({ serviceId: item.id, time: null })} className={`block w-full rounded-2xl px-4 py-3 text-left ${booking.serviceId === item.id ? "bg-accent ring-1 ring-teal" : "bg-white ring-1 ring-border"}`}>
            <span className="block text-sm font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">{item.durationMin} min · {item.modality === "teleconsulta" ? "teleconsulta demonstrativa" : "presencial"} · {formatMoney(item.price)}</span>
          </button>
        )) : null}

        {step === 2 ? (
          <div className="flex gap-2 overflow-x-auto phone-scroll pb-2">
            {days.map((date) => {
              const key = toDateKey(date)
              const works = professional?.workDays.includes(date.getDay())
              return (
                <button key={key} type="button" disabled={!works} onClick={() => patchBooking({ date: key, time: null })} className={`w-16 shrink-0 rounded-2xl px-2 py-3 text-center ${booking.date === key ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"} disabled:opacity-40`}>
                  <span className="block text-[11px]">{WEEKDAY_SHORT[date.getDay()]}</span>
                  <span className="block text-lg font-semibold">{date.getDate()}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {step === 3 ? (
          slots.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground ring-1 ring-border">Não há horário livre nesse dia. Escolha outra data.</p> : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button key={slot.time} type="button" onClick={() => patchBooking({ time: slot.time })} className={`rounded-2xl py-3 text-sm ${booking.time === slot.time ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>
                  {slot.time}
                </button>
              ))}
            </div>
          )
        ) : null}

        {step === 4 && professional && service && booking.date && booking.time ? (
          <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
            <p className="text-sm text-muted-foreground">Revisão</p>
            <p className="mt-2 font-medium">{professional.name}</p>
            <p className="text-sm">{service.name}</p>
            <p className="text-sm">{formatDate(`${booking.date}T12:00:00`, "EEEE, d 'de' MMMM")} às {booking.time}</p>
            <p className="mt-2 text-lg font-semibold">{formatMoney(service.price)}</p>
            <p className="mt-2 text-xs text-muted-foreground">O horário reservado deixa de aparecer para novos agendamentos.</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex gap-2">
        {step > 0 ? <Button type="button" variant="outline" className="flex-1" onClick={() => setStep((current) => current - 1)}>Voltar</Button> : <Button asChild variant="outline" className="flex-1"><Link href="/mobile/buscar">Voltar</Link></Button>}
        {step < 4 ? <Button type="button" className="flex-1" onClick={next}>Continuar</Button> : booking.rescheduleAppointmentId ? (
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              const result = confirmReschedule()
              if (!result.ok) {
                toast.error(result.message)
                return
              }
              toast.success("Consulta reagendada na demonstração.")
              router.push("/mobile/consultas")
            }}
          >
            Confirmar horário
          </Button>
        ) : (
          <Button type="button" className="flex-1" onClick={() => router.push("/mobile/pagamento")}>Continuar para pagamento</Button>
        )}
      </div>
    </div>
  )
}
