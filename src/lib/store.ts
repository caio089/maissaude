"use client"

import { addMinutes, formatISO } from "date-fns"
import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"
import { associateQuote, DEFAULT_ASSOCIATE_RULES, normalizeAssociateRules, findActiveAssociate, associateRulesError } from "@/lib/associate-rules"
import { combineDateAndTime, createId, createReference, toDateKey } from "@/lib/format"
import { findConflict, serviceOf } from "@/lib/schedule"
import { createSeed, emptyBooking } from "@/lib/seed"
import {
  CHANNEL_NAME,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type AgendaView,
  type AppointmentInput,
  type Associate,
  type AssociateInput,
  type AssociateRules,
  type CashEntry,
  type CashEntryInput,
  type BookingDraft,
  type CartLine,
  type CheckoutReceipt,
  type MobileAccount,
  type DashboardPeriod,
  type DemoData,
  type MobileFilters,
  type Patient,
  type PatientInput,
  type PaymentMethod,
  type Professional,
  type ProfessionalInput,
  type Service,
  type Specialty,
  SPECIALTY_LABEL,
} from "@/lib/types"

export interface DemoStore {
  data: DemoData
  booking: BookingDraft
  lastCheckout: CheckoutReceipt | null
  mobileAccounts: MobileAccount[]
  associates: Associate[]
  associateRules: AssociateRules
  cashEntries: CashEntry[]
  mobileSessionPatientId: string | null
  dashboardPeriod: DashboardPeriod
  mobileCity: string
  agendaView: AgendaView
  agendaDate: string
  agendaProfessionalId: string
  agendaSpecialty: Specialty | "all"
  mobileFilters: MobileFilters
  patientFocusId: string | null
  recordPatientId: string | null
  patientSearch: string
  setDashboardPeriod: (period: DashboardPeriod) => void
  setMobileCity: (city: string) => void
  setAgendaView: (view: AgendaView) => void
  setAgendaDate: (date: string) => void
  setAgendaProfessionalId: (id: string) => void
  setAgendaSpecialty: (specialty: Specialty | "all") => void
  setMobileFilters: (filters: Partial<MobileFilters>) => void
  setPatientFocusId: (id: string | null) => void
  setRecordPatientId: (id: string | null) => void
  setPatientSearch: (query: string) => void
  patchBooking: (patch: Partial<BookingDraft>) => void
  startBooking: (professionalId: string) => void
  clearBooking: () => void
  registerMobileAccount: (input: { name: string; cpf: string; phone: string; birthDate: string; passwordHash: string }) => { ok: true } | { ok: false; message: string }
  loginMobileAccount: (input: { cpf: string; passwordHash: string }) => { ok: true } | { ok: false; message: string }
  logoutMobileAccount: () => void
  adoptPatientSession: (patient: Patient) => void
  clearCheckout: () => void
  markNotificationsRead: () => void
  createPatient: (input: PatientInput) => string
  updatePatient: (id: string, input: PatientInput) => void
  createAssociate: (input: AssociateInput) => { ok: true; id: string } | { ok: false; message: string }
  updateAssociate: (id: string, input: AssociateInput) => { ok: true } | { ok: false; message: string }
  subscribeCurrentPatient: () => { ok: true } | { ok: false; message: string }
  updateAssociateRules: (rules: AssociateRules) => { ok: true } | { ok: false; message: string }
  createCashEntry: (input: CashEntryInput) => { ok: true; id: string } | { ok: false; message: string }
  removeCashEntry: (id: string) => void
  updateCurrentPatient: (patch: Partial<Pick<PatientInput, "name" | "phone" | "email" | "city">> & { reminderEnabled?: boolean }) => void
  createProfessional: (input: ProfessionalInput) => string
  updateProfessional: (id: string, input: ProfessionalInput) => void
  createAppointment: (input: AppointmentInput) => { ok: true; id: string } | { ok: false; message: string }
  rescheduleAppointment: (id: string, date: string, time: string) => { ok: true } | { ok: false; message: string }
  setAppointmentStatus: (id: string, status: DemoData["appointments"][number]["status"]) => void
  cancelAppointment: (id: string) => void
  blockSlot: (input: { professionalId: string; date: string; start: string; end: string; reason: string }) => { ok: true } | { ok: false; message: string }
  removeBlock: (id: string) => void
  settlePayment: (paymentId: string, method: PaymentMethod) => void
  simulateCheckout: (method: PaymentMethod, outcome: "approved" | "declined") => { ok: true; receipt: CheckoutReceipt } | { ok: false; message: string }
  checkoutCart: (lines: CartLine[], method: PaymentMethod, outcome: "approved" | "declined") => { ok: true; receipt: CheckoutReceipt } | { ok: false; message: string }
  confirmReschedule: () => { ok: true } | { ok: false; message: string }
  updateRecord: (id: string, patch: { notes?: string; evolution?: string; dentalNote?: string }) => void
  resetDemo: () => void
  realignToToday: () => void
}

const defaultFilters: MobileFilters = {
  query: "",
  specialty: "all",
  modality: "all",
  priceMin: 0,
  priceMax: 500,
  minRating: 0,
  onlyAvailable: false,
}

function createInitialState() {
  return {
    data: createSeed(new Date()),
    booking: emptyBooking(),
    lastCheckout: null as CheckoutReceipt | null,
    mobileAccounts: [] as MobileAccount[],
    associates: [] as Associate[],
    associateRules: DEFAULT_ASSOCIATE_RULES,
    cashEntries: [] as CashEntry[],
    mobileSessionPatientId: null as string | null,
    dashboardPeriod: "30d" as DashboardPeriod,
    mobileCity: "Teresina - PI",
    agendaView: "week" as AgendaView,
    agendaDate: "",
    agendaProfessionalId: "all",
    agendaSpecialty: "all" as Specialty | "all",
    mobileFilters: defaultFilters,
    patientFocusId: null as string | null,
    recordPatientId: null as string | null,
    patientSearch: "",
  }
}

function safeStorage(): StateStorage {
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      if (localStorage.getItem(name) === value) return
      localStorage.setItem(name, value)
    },
    removeItem: (name) => localStorage.removeItem(name),
  }
}

function buildServices(professionalId: string, price: number, specialty: Specialty) {
  const services: Array<{ id: string; name: string; durationMin: number; price: number; modality: "presencial" | "teleconsulta" }> = [
    {
      id: `${professionalId}-consulta`,
      name: "Consulta de demonstração",
      durationMin: 40,
      price,
      modality: "presencial" as const,
    },
    {
      id: `${professionalId}-retorno`,
      name: "Retorno demonstrativo",
      durationMin: 40,
      price: Math.round(price * 0.6),
      modality: "presencial" as const,
    },
  ]
  if (specialty !== "odontologia" && specialty !== "fisioterapia") {
    services.push({
      id: `${professionalId}-tele`,
      name: "Teleconsulta demonstrativa",
      durationMin: 40,
      price,
      modality: "teleconsulta",
    })
  }
  return services
}

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      setDashboardPeriod: (dashboardPeriod) => set({ dashboardPeriod }),
      setMobileCity: (mobileCity) => set({ mobileCity }),
      setAgendaView: (agendaView) => set({ agendaView }),
      setAgendaDate: (agendaDate) => set({ agendaDate }),
      setAgendaProfessionalId: (agendaProfessionalId) => set({ agendaProfessionalId }),
      setAgendaSpecialty: (agendaSpecialty) => set({ agendaSpecialty }),
      setMobileFilters: (filters) => set((state) => ({ mobileFilters: { ...state.mobileFilters, ...filters } })),
      setPatientFocusId: (patientFocusId) => set({ patientFocusId }),
      setRecordPatientId: (recordPatientId) => set({ recordPatientId }),
      setPatientSearch: (patientSearch) => set({ patientSearch }),
      patchBooking: (patch) => set((state) => ({ booking: { ...state.booking, ...patch } })),
      startBooking: (professionalId) =>
        set({
          booking: { ...emptyBooking(), professionalId },
          lastCheckout: null,
        }),
      clearBooking: () => set({ booking: emptyBooking() }),
      registerMobileAccount: ({ name, cpf, phone, birthDate, passwordHash }) => {
        const normalizedCpf = cpf.trim()
        const normalizedPhone = phone.trim()
        const state = get()
        if (!/^\(\d{2}\) \d{5}-\d{4}$/.test(normalizedPhone)) {
          return { ok: false, message: "Use um WhatsApp fictício no formato (86) 99000-0000." }
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > toDateKey(new Date())) {
          return { ok: false, message: "Informe uma data de nascimento fictícia que já tenha ocorrido." }
        }
        if (state.mobileAccounts.some((account) => account.cpf === normalizedCpf)) {
          return { ok: false, message: "Este CPF já tem conta nesta demonstração. Entre com a senha." }
        }
        const existing = state.data.patients.find((patient) => patient.cpf === normalizedCpf)
        if (existing) {
          set({
            mobileAccounts: [...state.mobileAccounts, { cpf: normalizedCpf, patientId: existing.id, passwordHash }],
            mobileSessionPatientId: existing.id,
            lastCheckout: null,
            booking: emptyBooking(),
            data: {
              ...state.data,
              currentPatientId: existing.id,
              patients: state.data.patients.map((patient) =>
                patient.id === existing.id ? { ...patient, name: name.trim(), phone: normalizedPhone, birthDate } : patient,
              ),
            },
          })
          return { ok: true }
        }
        const id = createId("pat")
        const contact = nextDemoContact(state.data.patients)
        const patient = {
          id,
          name: name.trim(),
          cpf: normalizedCpf,
          phone: normalizedPhone,
          email: contact.email,
          birthDate,
          gender: "Não informado",
          address: "Endereço fictício informado no aplicativo",
          city: state.mobileCity,
          status: "active" as const,
          notes: "Conta criada no aplicativo de demonstração.",
          createdAt: formatISO(new Date()),
          reminderEnabled: true,
        }
        set({
          mobileAccounts: [...state.mobileAccounts, { cpf: normalizedCpf, patientId: id, passwordHash }],
          mobileSessionPatientId: id,
          lastCheckout: null,
          booking: emptyBooking(),
          data: { ...state.data, currentPatientId: id, patients: [patient, ...state.data.patients] },
        })
        return { ok: true }
      },
      loginMobileAccount: ({ cpf, passwordHash }) => {
        const account = get().mobileAccounts.find((item) => item.cpf === cpf.trim())
        if (!account || account.passwordHash !== passwordHash) {
          return { ok: false, message: "CPF ou senha de demonstração não conferem." }
        }
        set((state) => ({
          mobileSessionPatientId: account.patientId,
          lastCheckout: null,
          booking: emptyBooking(),
          data: { ...state.data, currentPatientId: account.patientId },
        }))
        return { ok: true }
      },
      logoutMobileAccount: () => set({ mobileSessionPatientId: null, booking: emptyBooking(), lastCheckout: null }),
      adoptPatientSession: (patient) =>
        set((state) => {
          const exists = state.data.patients.some((item) => item.id === patient.id)
          return {
            mobileSessionPatientId: patient.id,
            lastCheckout: null,
            booking: emptyBooking(),
            data: {
              ...state.data,
              currentPatientId: patient.id,
              patients: exists
                ? state.data.patients.map((item) => (item.id === patient.id ? { ...item, ...patient } : item))
                : [patient, ...state.data.patients],
            },
          }
        }),
      clearCheckout: () => set({ lastCheckout: null, booking: emptyBooking() }),
      markNotificationsRead: () =>
        set((state) => ({
          data: {
            ...state.data,
            readNotificationIds: ["notif-upcoming", "notif-pending", "notif-noshow", `notif-today-${toDateKey(new Date())}`],
          },
        })),
      createAssociate: (input) => {
        const conflict = associateConflict(get().associates, input)
        if (conflict) return { ok: false, message: conflict }
        const id = createId("ass")
        const associate: Associate = {
          id,
          name: input.name.trim(),
          cpf: input.cpf.trim(),
          phone: input.phone.trim(),
          email: input.email.trim(),
          status: input.status,
          createdAt: formatISO(new Date()),
        }
        set((state) => ({ associates: [associate, ...state.associates] }))
        return { ok: true, id }
      },
      updateAssociate: (id, input) => {
        const conflict = associateConflict(get().associates, input, id)
        if (conflict) return { ok: false, message: conflict }
        set((state) => ({
          associates: state.associates.map((associate) =>
            associate.id === id
              ? {
                  ...associate,
                  name: input.name.trim(),
                  cpf: input.cpf.trim(),
                  phone: input.phone.trim(),
                  email: input.email.trim(),
                  status: input.status,
                }
              : associate,
          ),
        }))
        return { ok: true }
      },
      // A conta do aplicativo só vira associada por esta assinatura mensal.
      subscribeCurrentPatient: () => {
        const state = get()
        const patient = state.data.patients.find((item) => item.id === state.mobileSessionPatientId)
        if (!patient) return { ok: false, message: "Entre na conta para assinar." }
        const input: AssociateInput = {
          name: patient.name,
          cpf: patient.cpf,
          phone: patient.phone,
          email: patient.email,
          status: "active",
        }
        const existing = state.associates.find((item) => item.cpf.trim() === patient.cpf.trim())
        if (existing?.status === "active") return { ok: false, message: "Esta conta já tem assinatura de associado." }
        if (existing) return get().updateAssociate(existing.id, input)
        const created = get().createAssociate(input)
        return created.ok ? { ok: true } : created
      },
      updateAssociateRules: (rules) => {
        const next = normalizeAssociateRules(rules)
        const message = associateRulesError(next)
        if (message) return { ok: false, message }
        set({ associateRules: next })
        return { ok: true }
      },
      createCashEntry: (input) => {
        const message = cashEntryError(input)
        if (message) return { ok: false, message }
        const id = createId("cash")
        const entry: CashEntry = {
          id,
          kind: input.kind,
          category: input.category,
          description: input.description.trim(),
          amount: roundMoney(input.amount),
          occurredOn: input.occurredOn,
          createdAt: formatISO(new Date()),
        }
        set((state) => ({ cashEntries: [entry, ...state.cashEntries] }))
        return { ok: true, id }
      },
      removeCashEntry: (id) => set((state) => ({ cashEntries: state.cashEntries.filter((entry) => entry.id !== id) })),
      createPatient: (input) => {
        const id = createId("pat")
        const patient = {
          id,
          ...input,
          name: input.name.trim(),
          createdAt: formatISO(new Date()),
          reminderEnabled: true,
        }
        set((state) => ({ data: { ...state.data, patients: [patient, ...state.data.patients] } }))
        return id
      },
      updatePatient: (id, input) =>
        set((state) => ({
          data: {
            ...state.data,
            patients: state.data.patients.map((patient) => (patient.id === id ? { ...patient, ...input, name: input.name.trim() } : patient)),
          },
        })),
      updateCurrentPatient: (patch) =>
        set((state) => ({
          data: {
            ...state.data,
            patients: state.data.patients.map((patient) =>
              patient.id === state.data.currentPatientId ? { ...patient, ...patch } : patient,
            ),
          },
        })),
      createProfessional: (input) => {
        const id = createId("pro")
        const professional = {
          id,
          name: input.name.trim(),
          specialty: input.specialty,
          credentialLabel: "Registro demonstrativo",
          credentialCode: input.credentialCode.trim().toUpperCase(),
          bio: input.bio.trim(),
          price: input.price,
          rating: 5,
          reviewCount: 1,
          reviews: [
            {
              id: `${id}-review-1`,
              author: "Paciente de demonstração",
              rating: 5,
              comment: "Avaliação fictícia gerada ao cadastrar o profissional nesta demonstração.",
              date: toDateKey(new Date()),
              demonstrative: true as const,
            },
          ],
          workDays: input.workDays,
          startHour: input.startHour,
          endHour: input.endHour,
          location: get().data.clinic.address,
          services: buildServices(id, input.price, input.specialty),
          active: input.active,
          avatarSeed: input.name,
        }
        set((state) => ({ data: { ...state.data, professionals: [...state.data.professionals, professional] } }))
        return id
      },
      updateProfessional: (id, input) =>
        set((state) => ({
          data: {
            ...state.data,
            professionals: state.data.professionals.map((professional) => {
              if (professional.id !== id) return professional
              const priceChanged = professional.price !== input.price
              return {
                ...professional,
                name: input.name.trim(),
                specialty: input.specialty,
                credentialCode: input.credentialCode.trim().toUpperCase(),
                bio: input.bio.trim(),
                price: input.price,
                workDays: input.workDays,
                startHour: input.startHour,
                endHour: input.endHour,
                active: input.active,
                services: priceChanged ? buildServices(id, input.price, input.specialty) : professional.services.map((service) => (
                  service.name.startsWith("Consulta") ? { ...service, price: input.price } : service
                )),
              }
            }),
          },
        })),
      createAppointment: (input) => {
        const { data } = get()
        const professional = data.professionals.find((item) => item.id === input.professionalId)
        const service = professional ? serviceOf(professional, input.serviceId) : undefined
        if (!professional || !service) return { ok: false, message: "Selecione um profissional e um serviço." }
        const startsAt = combineDateAndTime(input.date, input.time)
        const endsAt = addMinutes(startsAt, service.durationMin)
        if (startsAt.getTime() <= Date.now()) return { ok: false, message: "Escolha um horário futuro." }
        const conflict = findConflict(professional.id, startsAt, endsAt, data.appointments, data.blockedSlots)
        if (conflict) return { ok: false, message: conflict.label }
        const appointmentId = createId("apt")
        const paymentId = createId("pay")
        set((state) => ({
          data: {
            ...state.data,
            appointments: [
              {
                id: appointmentId,
                patientId: input.patientId,
                professionalId: professional.id,
                serviceId: service.id,
                startsAt: formatISO(startsAt),
                endsAt: formatISO(endsAt),
                status: "scheduled",
                modality: service.modality,
                notes: input.notes.trim() || "Agendamento criado no painel de demonstração.",
                createdAt: formatISO(new Date()),
                origin: "desktop",
                paymentId,
              },
              ...state.data.appointments,
            ],
            payments: [
              {
                id: paymentId,
                appointmentId,
                patientId: input.patientId,
                professionalId: professional.id,
                amount: service.price,
                method: "pix",
                status: "pending",
                createdAt: formatISO(new Date()),
                reference: createReference(),
                simulated: true,
                description: `${service.name} · ${professional.name}`,
              },
              ...state.data.payments,
            ],
          },
        }))
        return { ok: true, id: appointmentId }
      },
      rescheduleAppointment: (id, date, time) => {
        const { data } = get()
        const current = data.appointments.find((item) => item.id === id)
        const professional = data.professionals.find((item) => item.id === current?.professionalId)
        const service = professional && current ? serviceOf(professional, current.serviceId) : undefined
        if (!current || !professional || !service) return { ok: false, message: "Consulta não encontrada." }
        if (current.status === "cancelled" || current.status === "completed") {
          return { ok: false, message: "Esta consulta não pode ser reagendada." }
        }
        const startsAt = combineDateAndTime(date, time)
        const endsAt = addMinutes(startsAt, service.durationMin)
        if (startsAt.getTime() <= Date.now()) return { ok: false, message: "Escolha um horário futuro." }
        const conflict = findConflict(professional.id, startsAt, endsAt, data.appointments, data.blockedSlots, id)
        if (conflict) return { ok: false, message: conflict.label }
        set((state) => ({
          data: {
            ...state.data,
            appointments: state.data.appointments.map((item) =>
              item.id === id ? { ...item, startsAt: formatISO(startsAt), endsAt: formatISO(endsAt), status: "scheduled" } : item,
            ),
          },
          booking: emptyBooking(),
        }))
        return { ok: true }
      },
      setAppointmentStatus: (id, status) =>
        set((state) => ({
          data: {
            ...state.data,
            appointments: state.data.appointments.map((item) => (item.id === id ? { ...item, status } : item)),
          },
        })),
      cancelAppointment: (id) =>
        set((state) => ({
          data: {
            ...state.data,
            appointments: state.data.appointments.map((item) => (item.id === id ? { ...item, status: "cancelled" } : item)),
            payments: state.data.payments.flatMap((payment) => {
              if (payment.appointmentId !== id) return [payment]
              if (payment.status === "paid") return [{ ...payment, status: "refunded" as const }]
              if (payment.status === "pending") return []
              return [payment]
            }),
          },
        })),
      blockSlot: (input) => {
        const startsAt = combineDateAndTime(input.date, input.start)
        const endsAt = combineDateAndTime(input.date, input.end)
        if (endsAt <= startsAt) return { ok: false, message: "O fim do bloqueio precisa ser depois do início." }
        const conflict = findConflict(input.professionalId, startsAt, endsAt, get().data.appointments, get().data.blockedSlots)
        if (conflict?.kind === "appointment") return { ok: false, message: "Já existe uma consulta nesse intervalo." }
        set((state) => ({
          data: {
            ...state.data,
            blockedSlots: [
              ...state.data.blockedSlots,
              {
                id: createId("block"),
                professionalId: input.professionalId,
                startsAt: formatISO(startsAt),
                endsAt: formatISO(endsAt),
                reason: input.reason.trim() || "Bloqueio demonstrativo",
                origin: "desktop",
              },
            ],
          },
        }))
        return { ok: true }
      },
      removeBlock: (id) =>
        set((state) => ({
          data: { ...state.data, blockedSlots: state.data.blockedSlots.filter((item) => item.id !== id) },
        })),
      settlePayment: (paymentId, method) =>
        set((state) => {
          const payment = state.data.payments.find((item) => item.id === paymentId)
          if (!payment || payment.status !== "pending") return state
          return {
            data: {
              ...state.data,
              payments: state.data.payments.map((item) =>
                item.id === paymentId ? { ...item, status: "paid", method, paidAt: formatISO(new Date()), simulated: true } : item,
              ),
              appointments: state.data.appointments.map((item) =>
                item.id === payment.appointmentId && item.status === "scheduled" ? { ...item, status: "confirmed" } : item,
              ),
            },
          }
        }),
      simulateCheckout: (method, outcome) => {
        const { booking, data } = get()
        if (!booking.professionalId || !booking.serviceId || !booking.date || !booking.time) {
          return { ok: false, message: "Complete profissional, serviço, data e horário antes do pagamento." }
        }
        const professional = data.professionals.find((item) => item.id === booking.professionalId)
        const service = professional ? serviceOf(professional, booking.serviceId) : undefined
        if (!professional || !service) return { ok: false, message: "O serviço selecionado não está mais disponível." }
        const patient = data.patients.find((item) => item.id === data.currentPatientId)
        const associate = patient ? findActiveAssociate(get().associates, patient.cpf) : null
        const quote = associateQuote(service.price, get().associateRules, associate)
        const startsAt = combineDateAndTime(booking.date, booking.time)
        const endsAt = addMinutes(startsAt, service.durationMin)
        if (outcome === "declined") {
          const receipt: CheckoutReceipt = {
            reference: createReference(),
            appointmentId: null,
            outcome: "declined",
            amount: quote.amount,
            method,
            associateBenefit: quote.benefit,
          }
          set((state) => ({
            lastCheckout: receipt,
            data: {
              ...state.data,
              payments: [
                {
                  id: createId("pay"),
                  appointmentId: null,
                  patientId: state.data.currentPatientId,
                  professionalId: professional.id,
                  amount: quote.amount,
                  method,
                  status: "declined",
                  createdAt: formatISO(new Date()),
                  reference: receipt.reference,
                  simulated: true,
                  description: `Tentativa recusada · ${professional.name}`,
                },
                ...state.data.payments,
              ],
            },
          }))
          return { ok: false, message: "Pagamento de demonstração recusado. O horário continua disponível." }
        }
        const conflict = findConflict(professional.id, startsAt, endsAt, data.appointments, data.blockedSlots)
        if (conflict) return { ok: false, message: "Esse horário já foi reservado. Volte e escolha outro." }
        const appointmentId = createId("apt")
        const paymentId = createId("pay")
        const reference = createReference()
        const receipt: CheckoutReceipt = {
          reference,
          appointmentId,
          outcome: "approved",
          amount: quote.amount,
          method,
          associateBenefit: quote.benefit,
        }
        set((state) => ({
          booking: emptyBooking(),
          lastCheckout: receipt,
          data: {
            ...state.data,
            appointments: [
              {
                id: appointmentId,
                patientId: state.data.currentPatientId,
                professionalId: professional.id,
                serviceId: service.id,
                startsAt: formatISO(startsAt),
                endsAt: formatISO(endsAt),
                status: "confirmed",
                modality: service.modality,
                notes: "Consulta confirmada pelo aplicativo de demonstração do paciente.",
                createdAt: formatISO(new Date()),
                origin: "mobile",
                paymentId,
              },
              ...state.data.appointments,
            ],
            payments: [
              {
                id: paymentId,
                appointmentId,
                patientId: state.data.currentPatientId,
                professionalId: professional.id,
                amount: quote.amount,
                method,
                status: "paid",
                createdAt: formatISO(new Date()),
                paidAt: formatISO(new Date()),
                reference,
                simulated: true,
                description: quote.benefit
                  ? `${service.name} · ${professional.name} · desconto de associado ${quote.benefit.discountPercent}%`
                  : `${service.name} · ${professional.name}`,
              },
              ...state.data.payments,
            ],
          },
        }))
        return { ok: true, receipt }
      },
      checkoutCart: (lines, method, outcome) => {
        if (lines.length === 0) return { ok: false, message: "Coloque ao menos um item no carrinho." }
        const { data } = get()
        const patient = data.patients.find((item) => item.id === data.currentPatientId)
        if (!patient) return { ok: false, message: "Entre na conta para continuar." }
        const associate = findActiveAssociate(get().associates, patient.cpf)
        const rules = get().associateRules
        const occupied = [...data.appointments]
        const prepared: PreparedLine[] = []
        for (const line of lines) {
          const professional = data.professionals.find((item) => item.id === line.professionalId)
          if (!professional) return { ok: false, message: "Um profissional do carrinho não está mais disponível." }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(line.date) || !/^\d{2}:\d{2}$/.test(line.time)) {
            return { ok: false, message: "Cada item precisa de dia e horário." }
          }
          const quote = line.kind === "consulta"
            ? associateQuote(line.price, rules, associate)
            : { amount: line.price, benefit: null }
          const startsAt = combineDateAndTime(line.date, line.time)
          const endsAt = addMinutes(startsAt, line.durationMin)
          if (outcome === "approved") {
            const conflict = findConflict(professional.id, startsAt, endsAt, occupied, data.blockedSlots)
            if (conflict) return { ok: false, message: `${line.serviceName} nesse horário já foi reservado. Volte e escolha outro.` }
            occupied.push({
              id: `hold-${prepared.length}`,
              patientId: patient.id,
              professionalId: professional.id,
              serviceId: line.serviceId,
              startsAt: formatISO(startsAt),
              endsAt: formatISO(endsAt),
              status: "confirmed",
              modality: "presencial",
              notes: "",
              createdAt: formatISO(new Date()),
              origin: "mobile",
            })
          }
          prepared.push({
            line,
            professional,
            service: lineService(professional, line),
            amount: quote.amount,
            benefit: quote.benefit,
            startsAt,
            endsAt,
          })
        }
        const listPrice = prepared.filter((item) => item.line.kind === "consulta").reduce((total, item) => total + item.line.price, 0)
        const benefitQuote = associateQuote(listPrice, rules, listPrice > 0 ? associate : null)
        const total = prepared.reduce((sum, item) => sum + item.amount, 0)
        const reference = createReference()
        if (outcome === "declined") {
          const receipt: CheckoutReceipt = {
            reference,
            appointmentId: null,
            outcome: "declined",
            amount: total,
            method,
            associateBenefit: benefitQuote.benefit,
            items: [],
          }
          set((state) => ({
            lastCheckout: receipt,
            data: {
              ...state.data,
              payments: [
                {
                  id: createId("pay"),
                  appointmentId: null,
                  patientId: state.data.currentPatientId,
                  professionalId: prepared[0].professional.id,
                  amount: total,
                  method,
                  status: "declined",
                  createdAt: formatISO(new Date()),
                  reference,
                  simulated: true,
                  description: "Tentativa recusada do carrinho",
                },
                ...state.data.payments,
              ],
            },
          }))
          return { ok: false, message: "Pagamento de demonstração recusado. O carrinho continua disponível." }
        }
        const createdAt = formatISO(new Date())
        const appointments = prepared.map((item) => ({
          id: createId("apt"),
          patientId: data.currentPatientId,
          professionalId: item.professional.id,
          serviceId: item.service.id,
          startsAt: formatISO(item.startsAt),
          endsAt: formatISO(item.endsAt),
          status: "confirmed" as const,
          modality: item.service.modality,
          notes: "Item confirmado pelo aplicativo de demonstração do paciente.",
          createdAt,
          origin: "mobile" as const,
        }))
        const paymentId = createId("pay")
        const receipt: CheckoutReceipt = {
          reference,
          appointmentId: appointments[0]?.id ?? null,
          outcome: "approved",
          amount: total,
          method,
          associateBenefit: benefitQuote.benefit,
          items: prepared.map((item, index) => ({
            serviceName: item.line.serviceName,
            professionalName: item.professional.name,
            specialtyLabel: SPECIALTY_LABEL[item.professional.specialty],
            startsAt: appointments[index].startsAt,
            amount: item.amount,
            kind: item.line.kind,
          })),
        }
        set((state) => ({
          booking: emptyBooking(),
          lastCheckout: receipt,
          data: {
            ...state.data,
            professionals: state.data.professionals.map((professional) => {
              const extras = prepared
                .filter((item) => item.professional.id === professional.id && !professional.services.some((service) => service.id === item.service.id))
                .map((item) => item.service)
              return extras.length === 0 ? professional : { ...professional, services: [...professional.services, ...extras] }
            }),
            appointments: [
              ...appointments.map((appointment) => ({ ...appointment, paymentId })),
              ...state.data.appointments,
            ],
            payments: [
              {
                id: paymentId,
                appointmentId: appointments[0]?.id ?? null,
                patientId: state.data.currentPatientId,
                professionalId: prepared[0].professional.id,
                amount: total,
                method,
                status: "paid" as const,
                createdAt,
                paidAt: createdAt,
                reference,
                simulated: true as const,
                description: prepared
                  .map((item) => benefitQuote.benefit && item.line.kind === "consulta"
                    ? `${item.line.serviceName} · ${item.professional.name} · desconto de associado ${benefitQuote.benefit.discountPercent}%`
                    : `${item.line.serviceName} · ${item.professional.name}`)
                  .join(" · "),
              },
              ...state.data.payments,
            ],
          },
        }))
        return { ok: true, receipt }
      },
      confirmReschedule: () => {
        const { booking } = get()
        if (!booking.rescheduleAppointmentId || !booking.date || !booking.time) {
          return { ok: false, message: "Escolha o novo dia e horário." }
        }
        return get().rescheduleAppointment(booking.rescheduleAppointmentId, booking.date, booking.time)
      },
      updateRecord: (id, patch) =>
        set((state) => ({
          data: {
            ...state.data,
            records: state.data.records.map((record) => (record.id === id ? { ...record, ...patch } : record)),
          },
        })),
      resetDemo: () => set(createInitialState()),
      realignToToday: () => {
        const state = get()
        const today = toDateKey(new Date())
        if (state.data.anchorDate === today && state.data.schemaVersion === SCHEMA_VERSION) return
        const fresh = createSeed(new Date())
        const customPatients = state.data.patients.filter((item) => !item.id.startsWith("pat-seed-"))
        const customProfessionals = state.data.professionals.filter((item) => !item.id.startsWith("pro-seed-"))
        const customAppointments = state.data.appointments.filter((item) => item.origin !== "seed")
        const customIds = new Set(customAppointments.map((item) => item.id))
        const customPayments = state.data.payments.filter(
          (item) => item.appointmentId === null || (item.appointmentId && customIds.has(item.appointmentId)),
        )
        const customRecords = state.data.records.filter((item) => !item.id.startsWith("rec-seed-"))
        const customBlocks = state.data.blockedSlots.filter((item) => item.origin !== "seed")
        set({
          data: {
            ...fresh,
            patients: [...fresh.patients, ...customPatients],
            professionals: [...fresh.professionals, ...customProfessionals],
            appointments: [...fresh.appointments, ...customAppointments],
            payments: [...fresh.payments, ...customPayments],
            records: [...fresh.records, ...customRecords],
            blockedSlots: [...fresh.blockedSlots, ...customBlocks],
          },
        })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(safeStorage),
      version: SCHEMA_VERSION,
      migrate: () => createInitialState(),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current
        const stored = persisted as Partial<DemoStore>
        if (!stored.data || stored.data.schemaVersion !== SCHEMA_VERSION) return current
        return {
          ...current,
          ...stored,
          associates: stored.associates ?? [],
          associateRules: normalizeAssociateRules(stored.associateRules),
          cashEntries: stored.cashEntries ?? [],
        }
      },
    },
  ),
)

interface PreparedLine {
  line: CartLine
  professional: Professional
  service: Service
  amount: number
  benefit: ReturnType<typeof associateQuote>["benefit"]
  startsAt: Date
  endsAt: Date
}

function lineService(professional: Professional, line: CartLine): Service {
  return professional.services.find((service) => service.id === line.serviceId) ?? {
    id: line.serviceId,
    name: line.serviceName,
    durationMin: line.durationMin,
    price: line.price,
    modality: "presencial",
  }
}

const INCOME_CATEGORIES = new Set(["consulta", "mensalidade", "exame", "outro"])
const EXPENSE_CATEGORIES = new Set(["aluguel", "salario", "material", "transporte", "outro"])

function cashEntryError(input: CashEntryInput) {
  if (input.description.trim().length < 3) return "Descreva o lançamento com ao menos 3 letras."
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 100000) {
    return "Informe um valor entre R$ 0,01 e R$ 100.000."
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return "Informe a data do lançamento."
  const allowed = input.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  if (!allowed.has(input.category)) return "Escolha uma categoria compatível com receita ou saída."
  return null
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function associateConflict(associates: Associate[], input: AssociateInput, ignoreId?: string) {
  const cpf = input.cpf.trim()
  if (associates.some((associate) => associate.id !== ignoreId && associate.cpf === cpf)) {
    return "Este CPF fictício já está cadastrado como associado."
  }
  return null
}

function nextDemoContact(patients: Array<{ phone: string; email: string }>) {
  for (let sequence = 26; sequence < 900; sequence += 1) {
    const code = String(sequence).padStart(3, "0")
    const phone = `(86) 99000-${code}0`
    const email = `conta.${code}@demonstracao.demo`
    if (!patients.some((patient) => patient.phone === phone || patient.email.toLowerCase() === email)) {
      return { phone, email }
    }
  }
  return { phone: "(86) 99000-9000", email: "conta.extra@demonstracao.demo" }
}

let syncClients = 0
let stopSync: (() => void) | null = null
let applyingRemote = false

export function retainDemoSync() {
  if (typeof window === "undefined") return () => {}
  if (syncClients === 0) {
    const tabId = crypto.randomUUID()
    const channel = new BroadcastChannel(CHANNEL_NAME)
    const rehydrate = () => {
      applyingRemote = true
      const pending = useDemoStore.persist.rehydrate()
      void Promise.resolve(pending).finally(() => {
        applyingRemote = false
      })
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) rehydrate()
    }
    const onMessage = (event: MessageEvent<{ type?: string; origin?: string }>) => {
      if (event.data?.type === "sync" && event.data.origin !== tabId) rehydrate()
    }
    window.addEventListener("storage", onStorage)
    channel.addEventListener("message", onMessage)
    const unsubscribe = useDemoStore.subscribe(() => {
      if (applyingRemote) return
      channel.postMessage({ type: "sync", origin: tabId })
    })
    stopSync = () => {
      window.removeEventListener("storage", onStorage)
      channel.removeEventListener("message", onMessage)
      channel.close()
      unsubscribe()
    }
  }
  syncClients += 1
  return () => {
    syncClients -= 1
    if (syncClients === 0 && stopSync) {
      stopSync()
      stopSync = null
    }
  }
}
