"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { isSameDay } from "date-fns"
import { AppointmentBars, RevenueArea } from "@/components/desktop/charts"
import { FadeIn } from "@/components/shared/fade-in"
import { StatusBadge } from "@/components/shared/status-badge"
import { Progress } from "@/components/ui/progress"
import { formatDate, formatMoney, greeting, percent } from "@/lib/format"
import { buildNotifications, computeDashboard } from "@/lib/metrics"
import { useDemoStore } from "@/lib/store"
import type { DashboardPeriod } from "@/lib/types"

const PERIODS: Array<{ id: DashboardPeriod; label: string }> = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "month", label: "Mês" },
]

export function DashboardView() {
  const data = useDemoStore((state) => state.data)
  const period = useDemoStore((state) => state.dashboardPeriod)
  const setPeriod = useDemoStore((state) => state.setDashboardPeriod)
  const [chart, setChart] = useState<"revenue" | "appointments">("revenue")
  const now = useMemo(() => new Date(), [])
  const metrics = computeDashboard(data, period, now)
  const alerts = buildNotifications(data, now).slice(0, 3)
  const today = data.appointments
    .filter((item) => item.status !== "cancelled" && isSameDay(new Date(item.startsAt), now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  return (
    <FadeIn className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{formatDate(now, "EEEE, d 'de' MMMM")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greeting(now)}, {data.clinic.name}</h1>
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
          <p className="text-sm text-white/75">Receita simulada do período</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{formatMoney(metrics.revenue)}</p>
          <p className="mt-2 text-sm text-white/75">
            {metrics.revenueDelta >= 0 ? "Alta" : "Queda"} de {percent(Math.abs(metrics.revenueDelta))} em relação ao período anterior.
          </p>
          <p className="mt-6 text-xs text-white/60">Valores calculados somente com pagamentos fictícios.</p>
        </article>
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
          <Metric label="Consultas de hoje" value={String(metrics.todayCount)} detail="Sem contar cancelamentos" />
          <Metric label="Pacientes atendidos" value={String(metrics.patientsSeen)} detail="Consultas realizadas no período" />
          <Metric label="Ocupação" value={percent(metrics.occupancy)} detail={`${formatMoney(metrics.pending)} pendentes`} progress={metrics.occupancy * 100} />
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
            {today.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma consulta fictícia para hoje.</p> : null}
            {today.map((item) => {
              const patient = data.patients.find((person) => person.id === item.patientId)
              const professional = data.professionals.find((person) => person.id === item.professionalId)
              return (
                <li key={item.id} className="flex gap-3">
                  <span className="w-12 pt-0.5 text-sm font-medium text-primary">{formatDate(item.startsAt, "HH:mm")}</span>
                  <span className="min-w-0 flex-1 border-l border-border pl-3">
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

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">Alertas operacionais</h2>
        <ul className="mt-4 grid gap-3 lg:grid-cols-3">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link href={alert.href} className="block h-full rounded-2xl bg-muted/70 px-4 py-3 hover:bg-accent">
                <span className="block text-sm font-medium">{alert.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{alert.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </FadeIn>
  )
}

function Metric({ label, value, detail, progress }: { label: string; value: string; detail: string; progress?: number }) {
  return (
    <article className="panel flex flex-col justify-between p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      {typeof progress === "number" ? <Progress value={progress} className="mt-3" /> : null}
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </article>
  )
}
