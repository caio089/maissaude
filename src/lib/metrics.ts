import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns"
import { formatDate, toDateKey } from "@/lib/format"
import type { Appointment, DashboardPeriod, DemoData, Payment } from "@/lib/types"

export interface DateRange {
  start: Date
  end: Date
}

export function periodRange(period: DashboardPeriod, now: Date): DateRange {
  const end = startOfDay(now)
  if (period === "7d") return { start: subDays(end, 6), end }
  if (period === "90d") return { start: subDays(end, 89), end }
  if (period === "month") return { start: startOfMonth(now), end }
  return { start: subDays(end, 29), end }
}

export function previousRange(range: DateRange): DateRange {
  const length = Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1
  const end = subDays(range.start, 1)
  return { start: subDays(end, length - 1), end }
}

function inRange(date: Date, range: DateRange) {
  return isWithinInterval(startOfDay(date), { start: range.start, end: range.end })
}

function paidInRange(payments: Payment[], range: DateRange) {
  return payments.filter((payment) => {
    if (payment.status !== "paid" || !payment.paidAt) return false
    return inRange(new Date(payment.paidAt), range)
  })
}

export function sumAmount(payments: Payment[]) {
  return payments.reduce((total, payment) => total + payment.amount, 0)
}

export interface DashboardMetrics {
  todayCount: number
  patientsSeen: number
  revenue: number
  pending: number
  occupancy: number
  revenueDelta: number
  appointmentDelta: number
  series: Array<{ label: string; revenue: number; appointments: number }>
  monthly: Array<{ label: string; revenue: number }>
}

export function computeDashboard(data: DemoData, period: DashboardPeriod, now: Date): DashboardMetrics {
  const range = periodRange(period, now)
  const previous = previousRange(range)
  const todayAppointments = data.appointments.filter(
    (item) => item.status !== "cancelled" && isSameDay(new Date(item.startsAt), now),
  )
  const completed = data.appointments.filter((item) => {
    if (item.status !== "completed") return false
    return inRange(new Date(item.startsAt), range)
  })
  const patientsSeen = new Set(completed.map((item) => item.patientId)).size
  const revenuePayments = paidInRange(data.payments, range)
  const previousRevenue = sumAmount(paidInRange(data.payments, previous))
  const revenue = sumAmount(revenuePayments)
  const pending = sumAmount(data.payments.filter((payment) => payment.status === "pending"))
  const occupancy = occupancyRate(data, range)
  const currentAppointments = data.appointments.filter((item) => {
    if (item.status === "cancelled") return false
    return inRange(new Date(item.startsAt), range)
  }).length
  const previousAppointments = data.appointments.filter((item) => {
    if (item.status === "cancelled") return false
    return inRange(new Date(item.startsAt), previous)
  }).length

  return {
    todayCount: todayAppointments.length,
    patientsSeen,
    revenue,
    pending,
    occupancy,
    revenueDelta: delta(revenue, previousRevenue),
    appointmentDelta: delta(currentAppointments, previousAppointments),
    series: buildSeries(data, range, period),
    monthly: buildMonthly(data, now),
  }
}

function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 1
  return (current - previous) / previous
}

function occupancyRate(data: DemoData, range: DateRange) {
  let open = 0
  let taken = 0
  const days = eachDayOfInterval(range)
  for (const day of days) {
    const weekday = day.getDay()
    for (const professional of data.professionals) {
      if (!professional.active || !professional.workDays.includes(weekday)) continue
      const capacity = estimateDailySlots(professional.startHour, professional.endHour)
      open += capacity
      const booked = data.appointments.filter((item) => {
        if (item.professionalId !== professional.id) return false
        if (item.status === "cancelled" || item.status === "no-show") return false
        return isSameDay(new Date(item.startsAt), day)
      }).length
      taken += Math.min(capacity, booked)
    }
  }
  if (open === 0) return 0
  return taken / open
}

function estimateDailySlots(startHour: string, endHour: string) {
  const [startH, startM] = startHour.split(":").map(Number)
  const [endH, endM] = endHour.split(":").map(Number)
  const minutes = ((endH ?? 18) * 60 + (endM ?? 0)) - ((startH ?? 8) * 60 + (startM ?? 0)) - 120
  return Math.max(1, Math.floor(minutes / 40))
}

function buildSeries(data: DemoData, range: DateRange, period: DashboardPeriod) {
  if (period === "90d") {
    const points: Array<{ label: string; revenue: number; appointments: number }> = []
    let cursor = range.start
    while (cursor <= range.end) {
      const weekEnd = addDays(cursor, 6)
      const slice = { start: cursor, end: weekEnd > range.end ? range.end : weekEnd }
      points.push({
        label: formatDate(cursor, "dd/MM"),
        revenue: sumAmount(paidInRange(data.payments, slice)),
        appointments: data.appointments.filter((item) => {
          if (item.status === "cancelled") return false
          return inRange(new Date(item.startsAt), slice)
        }).length,
      })
      cursor = addDays(weekEnd, 1)
    }
    return points
  }

  return eachDayOfInterval(range).map((day) => {
    const slice = { start: day, end: day }
    return {
      label: formatDate(day, "dd/MM"),
      revenue: sumAmount(paidInRange(data.payments, slice)),
      appointments: data.appointments.filter((item) => {
        if (item.status === "cancelled") return false
        return isSameDay(new Date(item.startsAt), day)
      }).length,
    }
  })
}

function buildMonthly(data: DemoData, now: Date) {
  const points: Array<{ label: string; revenue: number }> = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - offset, 1))
    const end = endOfMonth(start)
    points.push({
      label: formatDate(start, "MMM"),
      revenue: sumAmount(paidInRange(data.payments, { start, end })),
    })
  }
  return points
}

export interface OperationalAlert {
  id: string
  title: string
  body: string
  tone: "info" | "warning" | "success"
  href: string
}

export function buildNotifications(data: DemoData, now: Date): OperationalAlert[] {
  const upcoming = data.appointments.filter((item) => {
    if (item.status !== "scheduled" && item.status !== "confirmed") return false
    const start = new Date(item.startsAt).getTime()
    const diff = start - now.getTime()
    return diff >= 0 && diff <= 1000 * 60 * 60 * 4
  })
  const pending = data.payments.filter((payment) => payment.status === "pending")
  const noShows = data.appointments.filter((item) => {
    if (item.status !== "no-show") return false
    return now.getTime() - new Date(item.startsAt).getTime() < 1000 * 60 * 60 * 24 * 14
  })
  const items: OperationalAlert[] = []
  if (upcoming.length > 0) {
    items.push({
      id: "notif-upcoming",
      title: `${upcoming.length} consulta${upcoming.length > 1 ? "s" : ""} nas próximas horas`,
      body: "Confira a agenda de hoje antes de receber o paciente de demonstração.",
      tone: "info",
      href: "/desktop/agenda",
    })
  }
  if (pending.length > 0) {
    items.push({
      id: "notif-pending",
      title: `${pending.length} pagamento${pending.length > 1 ? "s" : ""} simulado${pending.length > 1 ? "s" : ""} em aberto`,
      body: "Valores pendentes desta demonstração. Nenhum cobrança real foi emitida.",
      tone: "warning",
      href: "/desktop/financeiro",
    })
  }
  if (noShows.length > 0) {
    items.push({
      id: "notif-noshow",
      title: `${noShows.length} falta${noShows.length > 1 ? "s" : ""} no histórico recente`,
      body: "Essas faltas estão no histórico fictício da agenda e não geram previsão automática.",
      tone: "warning",
      href: "/desktop/agenda",
    })
  }
  const todayCount = data.appointments.filter(
    (item) => item.status !== "cancelled" && isSameDay(new Date(item.startsAt), now),
  ).length
  items.push({
    id: `notif-today-${toDateKey(now)}`,
    title: todayCount > 0 ? `${todayCount} consultas na agenda de hoje` : "Agenda de hoje livre na simulação",
    body: "Indicadores calculados a partir dos agendamentos fictícios deste navegador.",
    tone: "success",
    href: "/desktop",
  })
  return items
}

