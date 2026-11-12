// Invalida dados demonstrativos salvos no localStorage em versões anteriores.
export const SCHEMA_VERSION = 2

const _SPECIALTIES = [
  "clinica-geral",
  "odontologia",
  "dermatologia",
  "cardiologia",
  "pediatria",
  "ginecologia",
  "fisioterapia",
] as const

export type BuiltinSpecialty = (typeof _SPECIALTIES)[number]
export type Specialty = BuiltinSpecialty | (string & {})
export type SpecialtyKey = BuiltinSpecialty

export const SPECIALTIES = _SPECIALTIES as unknown as readonly BuiltinSpecialty[] & {
  includes(searchElement: string, fromIndex?: number): searchElement is BuiltinSpecialty
}

export const SPECIALTY_LABEL: Record<string, string> = {
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
export type PaymentMethod = "pix" | "card" | "boleto"
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
  kind?: CatalogKind
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
  photoUrl?: string | null
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
  professionalId: string | null
  serviceId: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  modality: Modality
  notes: string
  createdAt: string
  origin: AppointmentOrigin
  paymentId?: string
  clinicId?: string | null
  clinicName?: string | null
  clinicAddress?: string | null
  clinicPhone?: string | null
  professionalName?: string | null
  serviceName?: string | null
  kind?: string | null
  price?: number
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
  simulated?: boolean
  description: string
  invoiceUrl?: string
  pixPayload?: string
  metadata?: Record<string, any> | null
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
  id?: string
  name: string
  legalName: string
  city: string
  address: string
  phone: string
  email: string
  active?: boolean
  createdAt?: string
}

export interface PartnerClinic {
  id: string
  name: string
  legalName?: string
  city: string
  address: string
  phone: string
  email?: string
  active?: boolean
  createdAt?: string
}

export const DEFAULT_CLINIC_PROFILE: ClinicProfile = {
  name: "CuidarSaude",
  legalName: "CuidarSaude Centro Médico Ltda",
  city: "Teresina - PI",
  address: "Rua Félix Pacheco, 2159 - Centro",
  phone: "(86) 3000-0000",
  email: "cuidarsaude2026@gmail.com",
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

export type CatalogKind = "consulta" | "exame" | "cirurgia"

export interface CatalogOffer {
  kind: CatalogKind
  serviceId: string
  serviceName: string
  professionalId: string | null
  price: number
  durationMin: number
  clinicId?: string | null
  clinicName?: string | null
}

export interface CartLine {
  key: string
  kind: CatalogKind
  professionalId: string
  serviceId: string
  serviceName: string
  price: number
  durationMin: number
  date: string
  time: string
}

export interface CheckoutItem {
  serviceName: string
  professionalName: string
  specialtyLabel: string
  startsAt: string
  amount: number
  kind: CatalogKind
}

export interface CheckoutReceipt {
  reference: string
  appointmentId: string | null
  outcome: "approved" | "declined"
  amount: number
  method: PaymentMethod
  associateBenefit?: AssociateBenefitSnapshot | null
  items?: CheckoutItem[]
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
  photoUrl?: string | null
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
  graceMonths?: number
}

export type AssociateStatus = "active" | "overdue" | "cancelled" | "inactive"

export interface Associate {
  id: string
  name: string
  cpf: string
  phone: string
  email: string
  status: AssociateStatus
  overdueMonths?: number
  nextDueDate?: string | null
  lastPaidAt?: string | null
  createdAt: string
}

export interface AssociateInput {
  name: string
  cpf: string
  phone: string
  email: string
  status: AssociateStatus
  overdueMonths?: number
  nextDueDate?: string | null
}

export type ClinicRole = "admin" | "attendant"

export interface ClinicTeamMember {
  id: string
  authUserId?: string | null
  name: string
  email: string
  role: ClinicRole
  status: "active" | "inactive"
  createdAt: string
}
