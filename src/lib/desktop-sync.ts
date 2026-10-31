import type { Appointment, AppointmentStatus, BlockedSlot, Modality, Patient, Payment, PaymentMethod, PaymentStatus } from "@/lib/types"

export type DbAppointmentRow = {
  id: string
  patient_id: string
  professional_id: string
  service_id: string
  starts_at: string
  ends_at: string
  status: string
  modality?: string
  notes?: string
  origin?: string
  payment_id?: string | null
  created_at?: string
}

export type DbPaymentRow = {
  id: string
  appointment_id?: string | null
  patient_id: string
  professional_id: string
  amount: number | string
  method: string
  status: string
  reference?: string
  simulated?: boolean
  description?: string
  created_at?: string
  paid_at?: string | null
}

export type DbBlockedSlotRow = {
  id: string
  professional_id: string
  starts_at: string
  ends_at: string
  reason?: string
  origin?: string
}

export type DbPatientRow = {
  id: string
  name: string
  cpf: string
  phone: string
  email: string
  birth_date?: string
  gender?: string
  address?: string
  city?: string
  status?: string
  notes?: string
  created_at?: string
  reminder_enabled?: boolean
}

export function mapDbAppointment(row: DbAppointmentRow): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    serviceId: row.service_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as AppointmentStatus,
    modality: (row.modality as Modality) || "presencial",
    notes: row.notes || "",
    origin: (row.origin as Appointment["origin"]) || "desktop",
    paymentId: row.payment_id || undefined,
    createdAt: row.created_at || row.starts_at,
  }
}

export function mapDbPayment(row: DbPaymentRow): Payment {
  return {
    id: row.id,
    appointmentId: row.appointment_id || null,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    amount: Number(row.amount),
    method: row.method as PaymentMethod,
    status: row.status as PaymentStatus,
    createdAt: row.created_at || new Date().toISOString(),
    paidAt: row.paid_at || undefined,
    reference: row.reference || row.id,
    simulated: Boolean(row.simulated),
    description: row.description || "Consulta",
  }
}

export function mapDbBlockedSlot(row: DbBlockedSlotRow): BlockedSlot {
  return {
    id: row.id,
    professionalId: row.professional_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason || "Horário indisponível",
    origin: (row.origin as BlockedSlot["origin"]) || "desktop",
  }
}

export function mapDbPatient(row: DbPatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    cpf: row.cpf,
    phone: row.phone,
    email: row.email,
    birthDate: row.birth_date || "",
    gender: row.gender || "",
    address: row.address || "",
    city: row.city || "Teresina",
    status: (row.status as Patient["status"]) || "active",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    reminderEnabled: Boolean(row.reminder_enabled ?? true),
  }
}
