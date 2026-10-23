"use client"

import { formatMoney } from "@/lib/format"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface Point {
  label: string
  revenue: number
  appointments: number
}

function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string | number
  money?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/10">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((item) => (
        <p key={String(item.name)} className="mt-1 text-muted-foreground">
          {item.name}: {money && typeof item.value === "number" ? formatMoney(item.value) : item.value}
        </p>
      ))}
    </div>
  )
}

export function RevenueArea({ data }: { data: Point[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#127e7a" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#127e7a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#d5e2e6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5d727c", fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#5d727c", fontSize: 12 }}
            tickFormatter={(value: number) => `${Math.round(value / 1000)} mil`}
            width={48}
          />
          <Tooltip content={<ChartTooltip money />} />
          <Area type="monotone" dataKey="revenue" name="Receita" stroke="#0d3b4c" strokeWidth={2} fill="url(#revenue-fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AppointmentBars({ data }: { data: Point[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#d5e2e6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5d727c", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#5d727c", fontSize: 12 }} width={32} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="appointments" name="Consultas" fill="#127e7a" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MonthlyBars({ data }: { data: Array<{ label: string; revenue: number }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#d5e2e6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5d727c", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5d727c", fontSize: 12 }} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} width={36} />
          <Tooltip content={<ChartTooltip money />} />
          <Bar dataKey="revenue" name="Receita" fill="#0d3b4c" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
