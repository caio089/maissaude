import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { AppointmentStatus, PaymentMethod, PaymentStatus } from "@/lib/types"

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function formatMoney(value: number) {
  return moneyFormatter.format(value)
}

export function formatDate(value: Date | string, pattern: string) {
  const date = typeof value === "string" ? new Date(value) : value
  return format(date, pattern, { locale: ptBR })
}

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function combineDateAndTime(dateKey: string, time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  const date = parseDateKey(dateKey)
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return date
}

export function timeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export function firstName(name: string) {
  const clean = name.replace(/^Dra?\.\s+/i, "")
  return clean.split(" ")[0] ?? name
}

export function professionalFirst(name: string) {
  return name.replace(/^Dra?\.\s+/i, "").split(" ")[0] ?? name
}

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
export const WEEKDAY_LONG = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
]

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  "no-show": "Falta",
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendente",
  paid: "Recebido",
  refunded: "Estornado",
  declined: "Recusado",
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix simulado",
  card: "Cartão simulado",
}

export function greeting(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

export function createId(prefix: string) {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8)
  return `${prefix}-${token}`
}

export function createReference() {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
  return `SP-DEMO-${token}`
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`
}
