import type { AppointmentStatus, PaymentStatus } from "@/lib/types"
import { PAYMENT_STATUS_LABEL, STATUS_LABEL } from "@/lib/format"

const appointmentClass: Record<AppointmentStatus, string> = {
  scheduled: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-teal-50 text-teal-800 ring-teal-200",
  completed: "bg-primary/10 text-primary ring-primary/15",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  "no-show": "bg-slate-100 text-slate-600 ring-slate-200",
}

const paymentClass: Record<PaymentStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  refunded: "bg-slate-100 text-slate-600 ring-slate-200",
  declined: "bg-rose-50 text-rose-700 ring-rose-200",
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${appointmentClass[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${paymentClass[status]}`}>
      {PAYMENT_STATUS_LABEL[status]} · simulado
    </span>
  )
}
