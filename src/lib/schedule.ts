import { addDays, addMinutes, formatISO } from "date-fns"
import { combineDateAndTime, parseDateKey, timeKey, toDateKey } from "@/lib/format"
import type { Appointment, BlockedSlot, Professional, Service } from "@/lib/types"

const BLOCKING = new Set<Appointment["status"]>(["scheduled", "confirmed"])

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA
}

export function serviceOf(professional: Professional, serviceId: string) {
  return professional.services.find((service) => service.id === serviceId)
}

export interface SlotConflict {
  kind: "appointment" | "block"
  label: string
}

export function findConflict(
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  appointments: Appointment[],
  blockedSlots: BlockedSlot[],
  ignoreAppointmentId?: string,
): SlotConflict | null {
  const appointment = appointments.find((item) => {
    if (item.id === ignoreAppointmentId) return false
    if (item.professionalId !== professionalId) return false
    if (!BLOCKING.has(item.status)) return false
    return rangesOverlap(startsAt, endsAt, new Date(item.startsAt), new Date(item.endsAt))
  })
  if (appointment) {
    return { kind: "appointment", label: "Horário já reservado" }
  }

  const block = blockedSlots.find((item) => {
    if (item.professionalId !== professionalId) return false
    return rangesOverlap(startsAt, endsAt, new Date(item.startsAt), new Date(item.endsAt))
  })
  if (block) return { kind: "block", label: block.reason }
  return null
}

function candidateTimes(professional: Professional, durationMin: number) {
  const [startHour, startMinute] = professional.startHour.split(":").map(Number)
  const [endHour, endMinute] = professional.endHour.split(":").map(Number)
  const start = (startHour ?? 8) * 60 + (startMinute ?? 0)
  const end = (endHour ?? 18) * 60 + (endMinute ?? 0)
  const lunchStart = 12 * 60
  const lunchEnd = 14 * 60
  const times: string[] = []

  for (let minute = start; minute + durationMin <= end; minute += 40) {
    const slotEnd = minute + durationMin
    const hitsLunch = minute < lunchEnd && slotEnd > lunchStart
    if (hitsLunch) continue
    const hours = Math.floor(minute / 60)
    const mins = minute % 60
    times.push(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`)
  }
  return times
}

export interface AvailableSlot {
  time: string
  startsAt: string
  endsAt: string
}

export function isOpenSlot(options: {
  professional: Professional
  service: Service
  dateKey: string
  time: string
  appointments: Appointment[]
  blockedSlots: BlockedSlot[]
  now?: Date
  ignoreAppointmentId?: string
}) {
  return availableSlots(options).some((slot) => slot.time === options.time)
}

export function availableSlots(options: {
  professional: Professional
  service: Service
  dateKey: string
  appointments: Appointment[]
  blockedSlots: BlockedSlot[]
  now?: Date
  ignoreAppointmentId?: string
}) {
  const now = options.now ?? new Date()
  const day = parseDateKey(options.dateKey)
  if (!options.professional.workDays.includes(day.getDay())) return []

  return candidateTimes(options.professional, options.service.durationMin).flatMap((time) => {
    const startsAt = combineDateAndTime(options.dateKey, time)
    const endsAt = addMinutes(startsAt, options.service.durationMin)
    if (startsAt.getTime() <= now.getTime()) return []
    const conflict = findConflict(
      options.professional.id,
      startsAt,
      endsAt,
      options.appointments,
      options.blockedSlots,
      options.ignoreAppointmentId,
    )
    if (conflict) return []
    return [{ time, startsAt: formatISO(startsAt), endsAt: formatISO(endsAt) }]
  })
}

export function hasAvailabilitySoon(
  professional: Professional,
  appointments: Appointment[],
  blockedSlots: BlockedSlot[],
  now = new Date(),
) {
  const service = professional.services[0]
  if (!service) return false
  for (let offset = 0; offset < 10; offset += 1) {
    const dateKey = toDateKey(addDays(now, offset))
    const slots = availableSlots({
      professional,
      service,
      dateKey,
      appointments,
      blockedSlots,
      now,
    })
    if (slots.length > 0) return true
  }
  return false
}

export function nextOpenSlot(
  professional: Professional,
  service: Service,
  appointments: Appointment[],
  blockedSlots: BlockedSlot[],
  now = new Date(),
) {
  for (let offset = 0; offset < 21; offset += 1) {
    const dateKey = toDateKey(addDays(now, offset))
    const slots = availableSlots({
      professional,
      service,
      dateKey,
      appointments,
      blockedSlots,
      now,
    })
    if (slots[0]) return { date: dateKey, time: slots[0].time }
  }
  return null
}

export function appointmentInterval(appointment: Appointment) {
  return {
    start: new Date(appointment.startsAt),
    end: new Date(appointment.endsAt),
  }
}

export function slotStamp(professionalId: string, startsAt: Date) {
  return `${professionalId}-${toDateKey(startsAt)}-${timeKey(startsAt)}`
}
