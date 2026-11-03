"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { isSameDay } from "date-fns"
import { CalendarDays, IdCard, Users, Wallet } from "lucide-react"
import { AppointmentBars, RevenueArea } from "@/components/desktop/charts"
import { FadeIn } from "@/components/shared/fade-in"
import { StatusBadge } from "@/components/shared/status-badge"
import { Progress } from "@/components/ui/progress"
import { formatDate, formatMoney, greeting, percent } from "@/lib/format"
import { mapDbAppointment, mapDbPayment, mapDbPatient } from "@/lib/desktop-sync"
import { buildNotifications, computeDashboard } from "@/lib/metrics"
import { useDemoStore } from "@/lib/store"
import type { Appointment, Associate, DashboardPeriod, Patient, Payment } from "@/lib/types"

const PERIODS: Array<{ id: DashboardPeriod; label: string }> = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "month", label: "Mês" },
]

export function DashboardView() {
  const data = useDemoStore((state) => state.data)
  const associates = useDemoStore((state) => state.associates)
  const period = useDemoStore((state) => state.dashboardPeriod)
  const setPeriod = useDemoStore((state) => state.setDashboardPeriod)
  const [chart, setChart] = useState<"revenue" | "appointments">("revenue")
  const [serverPayments, setServerPayments] = useState<Payment[]>([])
  const [serverAppointments, setServerAppointments] = useState<Appointment[]>([])
  const [serverPatients, setServerPatients] = useState<Patient[]>([])
  const [serverAssociates, setServerAssociates] = useState<Associate[]>([])

  useEffect(() => {
    let active = true
    fetch("/api/desktop/consultations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return
        const body = await response.json()
        if (active) {
          if (Array.isArray(body.payments)) setServerPayments(body.payments.map(mapDbPayment))
          if (Array.isArray(body.appointments)) setServerAppointments(body.appointments.map(mapDbAppointment))
          if (Array.isArray(body.patients)) setServerPatients(body.patients.map(mapDbPatient))
        }
      })
      .catch(() => {})

    fetch("/api/payments/associate", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as { associates?: (Associate & { created_at?: string })[] }
        if (active && Array.isArray(body.associates)) {
          setServerAssociates(
            body.associates.map((item) => ({
              ...item,
              createdAt: item.createdAt || item.created_at || new Date().toISOString(),
            })),
          )
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  const mergedData = useMemo(() => {
    const paymentMap = new Map<string, Payment>()
    for (const item of data.payments) paymentMap.set(item.id, item)
    for (const item of serverPayments) paymentMap.set(item.id, item)

    const appointmentMap = new Map<string, Appointment>()
    for (const item of data.appointments) appointmentMap.set(item.id, item)
    for (const item of serverAppointments) appointmentMap.set(item.id, item)

    const patientMap = new Map<string, Patient>()
    for (const item of data.patients) patientMap.set(item.id, item)
    for (const item of serverPatients) patientMap.set(item.id, item)

    return {
      ...data,
      payments: [...paymentMap.values()],
      appointments: [...appointmentMap.values()],
      patients: [...patientMap.values()],
    }
  }, [data, serverPayments, serverAppointments, serverPatients])

  const now = useMemo(() => new Date(), [])
  const metrics = computeDashboard(mergedData, period, now)
  const alerts = buildNotifications(mergedData, now).slice(0, 3)
  const allAssociates = useMemo(() => {
    const map = new Map<string, Associate>()
    for (const item of associates) map.set(item.cpf.replace(/\D/g, ""), item)
    for (const item of serverAssociates) map.set(item.cpf.replace(/\D/g, ""), item)
    return [...map.values()]
  }, [associates, serverAssociates])

  const activeAssociates = allAssociates.filter((item) => item.status === "active").length
  const today = mergedData.appointments
    .filter((item) => item.status !== "cancelled" && isSameDay(new Date(item.startsAt), now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  return (
    <FadeIn className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div suppressHydrationWarning>
          <p className="section-kicker">{data.clinic.city}</p>
          <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
            {formatDate(now, "EEEE, d 'de' MMMM")}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight" suppressHydrationWarning>
            {greeting(now)}, {data.clinic.name}
          </h1>
        </div>
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-foreground/10" role="group" aria-label="Período dos indicadores">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${period === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <article className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white lg:col-span-5">
          <p className="text-sm text-white/75">Receita do período</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{formatMoney(metrics.revenue)}</p>
          <p className="mt-2 text-sm text-white/75">
            {metrics.revenueDelta >= 0 ? "Alta" : "Queda"} de {percent(Math.abs(metrics.revenueDelta))} em relação ao período anterior.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/8 px-3 py-2">
              <dt className="text-white/60">Pendentes</dt>
              <dd className="mt-1 font-medium">{formatMoney(metrics.pending)}</dd>
            </div>
            <div className="rounded-2xl bg-white/8 px-3 py-2">
              <dt className="text-white/60">Associados ativos</dt>
              <dd className="mt-1 font-medium">{activeAssociates}</dd>
            </div>
          </dl>
        </article>
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
          <Metric icon={CalendarDays} label="Consultas de hoje" value={String(metrics.todayCount)} detail="Sem contar cancelamentos" href="/desktop/agenda" />
          <Metric icon={Users} label="Pacientes atendidos" value={String(metrics.patientsSeen)} detail="Consultas realizadas no período" href="/desktop/pacientes" />
          <Metric icon={Wallet} label="Ocupação" value={percent(metrics.occupancy)} detail={`${formatMoney(metrics.pending)} pendentes`} progress={metrics.occupancy * 100} href="/desktop/financeiro" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="panel p-5 xl:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Movimento da clínica</h2>
              <p className="text-sm text-muted-foreground">Os gráficos acompanham o período selecionado.</p>
            </div>
            <div className="flex rounded-lg bg-muted p-1">
              <button type="button" className={`rounded-md px-3 py-1 text-sm ${chart === "revenue" ? "bg-white shadow-sm" : ""}`} onClick={() => setChart("revenue")}>
                Faturamento
              </button>
              <button type="button" className={`rounded-md px-3 py-1 text-sm ${chart === "appointments" ? "bg-white shadow-sm" : ""}`} onClick={() => setChart("appointments")}>
                Consultas
              </button>
            </div>
          </div>
          {chart === "revenue" ? <RevenueArea data={metrics.series} /> : <AppointmentBars data={metrics.series} />}
        </div>
        <div className="panel p-5 xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Agenda de hoje</h2>
            <Link href="/desktop/agenda" className="text-sm text-teal hover:underline">Abrir</Link>
          </div>
          <ol className="mt-4 space-y-3">
            {today.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma consulta para hoje.</p> : null}
            {today.map((item) => {
              const patient = mergedData.patients.find((person) => person.id === item.patientId)
              const professional = data.professionals.find((person) => person.id === item.professionalId)
              return (
                <li key={item.id} className="flex gap-3 rounded-2xl bg-muted/60 px-3 py-2.5">
                  <span className="w-12 pt-0.5 text-sm font-medium text-primary">{formatDate(item.startsAt, "HH:mm")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{patient?.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{professional?.name}</span>
                    <span className="mt-1 inline-flex"><StatusBadge status={item.status} /></span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <Link href="/desktop/associados" className="panel flex items-center gap-3 p-4 hover:bg-accent/40">
          <span className="grid size-10 place-items-center rounded-2xl bg-accent text-teal"><IdCard className="size-4" /></span>
          <span>
            <span className="block text-sm font-medium">Associados</span>
            <span className="block text-xs text-muted-foreground">{activeAssociates} ativos neste cadastro</span>
          </span>
        </Link>
        {alerts.map((alert) => (
          <Link key={alert.id} href={alert.href} className="panel p-4 hover:bg-accent/40">
            <span className="block text-sm font-medium">{alert.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{alert.body}</span>
          </Link>
        ))}
      </section>
    </FadeIn>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  progress,
  href,
}: {
  icon: typeof CalendarDays
  label: string
  value: string
  detail: string
  progress?: number
  href: string
}) {
  return (
    <Link href={href} className="panel flex flex-col justify-between p-5 hover:bg-accent/30">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 text-teal" /> {label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      {typeof progress === "number" ? <Progress value={progress} className="mt-3" /> : null}
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </Link>
  )
}
