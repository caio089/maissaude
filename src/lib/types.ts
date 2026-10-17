export const SCHEMA_VERSION = 1

export const SPECIALTIES = [
  "clinica-geral",
  "odontologia",
  "dermatologia",
  "cardiologia",
  "pediatria",
  "ginecologia",
  "fisioterapia",
] as const

export type Specialty = (typeof SPECIALTIES)[number]

export const SPECIALTY_LABEL: Record<Specialty, string> = {
  "clinica-geral": "Clínica geral",
  odontologia: "Odontologia",
  dermatologia: "Dermatologia",
  cardiologia: "Cardiologia",
  pediatria: "Pediatria",
  ginecologia: "Ginecologia",
  fisioterapia: "Fisioterapia",
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no-show"

export type PaymentStatus = "pending" | "paid" | "refunded" | "declined"
export type PaymentMethod = "pix" | "card"
export type Modality = "presencial" | "teleconsulta"
export type PatientStatus = "active" | "inactive"
export type AppointmentOrigin = "seed" | "desktop" | "mobile"
export type DashboardPeriod = "7d" | "30d" | "90d" | "month"
export type AgendaView = "day" | "week" | "month"

export interface Service {
  id: string
  name: string
  durationMin: number
  price: number
  modality: Modality
}

export interface Review {
  id: string
  author: string
  rating: number
  comment: string
  date: string
  demonstrative: true
}

export interface Professional {
  id: string
  name: string
  specialty: Specialty
  credentialLabel: string
  credentialCode: string
  bio: string
  price: number
  rating: number
  reviewCount: number
  reviews: Review[]
  workDays: number[]
  startHour: string
  endHour: string
  location: string
  services: Service[]
  active: boolean
  avatarSeed: string
}

export interface Patient {
  id: string
  name: string
  cpf: string
  phone: string
  email: string
  birthDate: string
  gender: string
  address: string
  city: string
  status: PatientStatus
  notes: string
  createdAt: string
  reminderEnabled: boolean
}

export interface Appointment {
  id: string
  patientId: string
  professionalId: string
  serviceId: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  modality: Modality
  notes: string
  createdAt: string
  origin: AppointmentOrigin
  paymentId?: string
}

export interface Payment {
  id: string
  appointmentId: string | null
  patientId: string
  professionalId: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  createdAt: string
  paidAt?: string
  reference: string
  simulated: true
  description: string
}

export interface PrescriptionItem {
  id: string
  label: string
  instructions: string
  demonstrative: true
}

export interface ClinicalDocument {
  id: string
  title: string
  kind: string
  demonstrative: true
}

export interface MedicalRecord {
  id: string
  patientId: string
  professionalId: string
  appointmentId?: string
  date: string
  specialty: Specialty
  complaint: string
  notes: string
  evolution: string
  dentalNote?: string
  prescriptions: PrescriptionItem[]
  documents: ClinicalDocument[]
}

export interface BlockedSlot {
  id: string
  professionalId: string
  startsAt: string
  endsAt: string
  reason: string
  origin: AppointmentOrigin
}

export interface ClinicProfile {
  name: string
  legalName: string
  city: string
  address: string
  phone: string
  email: string
}

export interface BookingDraft {
  professionalId: string | null
  serviceId: string | null
  date: string | null
  time: string | null
  rescheduleAppointmentId: string | null
}

export interface MobileAccount {
  cpf: string
  patientId: string
  passwordHash: string
}

export interface CheckoutReceipt {
  reference: string
  appointmentId: string | null
  outcome: "approved" | "declined"
  amount: number
  method: PaymentMethod
  associateBenefit?: AssociateBenefitSnapshot | null
}

export interface AssociateBenefitSnapshot {
  name: string
  discountPercent: number
  listPrice: number
  amount: number
  transportRides: number
  extras: string[]
}

export interface MobileFilters {
  query: string
  specialty: Specialty | "all"
  modality: Modality | "all"
  priceMin: number
  priceMax: number
  minRating: number
  onlyAvailable: boolean
}

export interface DemoData {
  schemaVersion: number
  anchorDate: string
  clinic: ClinicProfile
  professionals: Professional[]
  patients: Patient[]
  appointments: Appointment[]
  payments: Payment[]
  records: MedicalRecord[]
  blockedSlots: BlockedSlot[]
  currentPatientId: string
  readNotificationIds: string[]
}

export interface PatientInput {
  name: string
  cpf: string
  phone: string
  email: string
  birthDate: string
  gender: string
  address: string
  city: string
  status: PatientStatus
  notes: string
}

export interface ProfessionalInput {
  name: string
  specialty: Specialty
  credentialCode: string
  bio: string
  price: number
  workDays: number[]
  startHour: string
  endHour: string
  active: boolean
}

export interface AppointmentInput {
  patientId: string
  professionalId: string
  serviceId: string
  date: string
  time: string
  notes: string
}

export const DEMO_CITIES = [
  "Teresina - PI",
  "Timon - MA",
  "Parnaíba - PI",
  "Picos - PI",
] as const

export const CLINIC_NAME = "CuidarSaude"
export const STORAGE_KEY = "cuidar-saude-demo-v1"
export const CHANNEL_NAME = "cuidar-saude-demo"
export const ASSOCIATE_FEE = 30

export type CashKind = "income" | "expense"
export type CashCategory = "consulta" | "mensalidade" | "exame" | "aluguel" | "salario" | "material" | "transporte" | "outro"

export interface CashEntry {
  id: string
  kind: CashKind
  category: CashCategory
  description: string
  amount: number
  occurredOn: string
  createdAt: string
}

export interface CashEntryInput {
  kind: CashKind
  category: CashCategory
  description: string
  amount: number
  occurredOn: string
}

export interface AssociateRules {
  fee: number
  consultationDiscountPercent: number
  transportEnabled: boolean
  transportRidesPerMonth: number
  extraBenefits: string[]
}

export interface Associate {
  id: string
  name: string
  cpf: string
  phone: string
  email: string
  status: PatientStatus
  createdAt: string
}

export interface AssociateInput {
  name: string
  cpf: string
  phone: string
  email: string
  status: PatientStatus
}
