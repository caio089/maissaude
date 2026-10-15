import { addDays, addMinutes, formatISO } from "date-fns"
import { combineDateAndTime, toDateKey } from "@/lib/format"
import { SCHEMA_VERSION, SPECIALTY_LABEL, type AppointmentStatus, type DemoData, type Patient, type Professional, type Service, type Specialty } from "@/lib/types"

const CLINIC_ADDRESS = "Av. da Demonstração, 1500, sala 3, Centro — Teresina - PI"

interface ProfessionalDraft {
  id: string
  name: string
  specialty: Specialty
  credentialCode: string
  price: number
  workDays: number[]
  startHour: string
  endHour: string
  bio: string
  tele: boolean
}

const PROFESSIONAL_DRAFTS: ProfessionalDraft[] = [
  {
    id: "pro-seed-01",
    name: "Dra. Helena Duarte",
    specialty: "clinica-geral",
    credentialCode: "DEMO-CRM-CG-01",
    price: 220,
    workDays: [1, 2, 3, 4, 5],
    startHour: "08:00",
    endHour: "18:00",
    bio: "Perfil fictício de clínica geral na unidade demonstrativa Saúde Prime, em Teresina.",
    tele: true,
  },
  {
    id: "pro-seed-02",
    name: "Dr. Rafael Nunes",
    specialty: "cardiologia",
    credentialCode: "DEMO-CRM-CA-02",
    price: 380,
    workDays: [1, 2, 3, 4, 5],
    startHour: "08:00",
    endHour: "17:00",
    bio: "Perfil fictício de cardiologia. O registro exibido é demonstrativo e não identifica um profissional real.",
    tele: true,
  },
  {
    id: "pro-seed-03",
    name: "Dra. Lívia Campos",
    specialty: "dermatologia",
    credentialCode: "DEMO-CRM-DE-03",
    price: 320,
    workDays: [1, 2, 3, 4, 5],
    startHour: "09:00",
    endHour: "18:00",
    bio: "Perfil fictício de dermatologia para a jornada de busca e agendamento do paciente.",
    tele: true,
  },
  {
    id: "pro-seed-04",
    name: "Dr. Otávio Pires",
    specialty: "odontologia",
    credentialCode: "DEMO-CRO-OD-04",
    price: 190,
    workDays: [1, 2, 3, 4, 5, 6],
    startHour: "08:00",
    endHour: "18:00",
    bio: "Perfil fictício de odontologia. A ficha usa a mesma linha do tempo das demais especialidades, com campo odontológico demonstrativo.",
    tele: false,
  },
  {
    id: "pro-seed-05",
    name: "Dra. Beatriz Lemos",
    specialty: "pediatria",
    credentialCode: "DEMO-CRM-PE-05",
    price: 250,
    workDays: [1, 2, 3, 4, 5],
    startHour: "08:00",
    endHour: "16:00",
    bio: "Perfil fictício de pediatria na agenda da manhã e do início da tarde.",
    tele: true,
  },
  {
    id: "pro-seed-06",
    name: "Dra. Camila Rocha",
    specialty: "ginecologia",
    credentialCode: "DEMO-CRM-GI-06",
    price: 290,
    workDays: [1, 2, 3, 4, 5],
    startHour: "09:00",
    endHour: "18:00",
    bio: "Perfil fictício de ginecologia. Avaliações e registros profissionais são apenas de demonstração.",
    tele: false,
  },
  {
    id: "pro-seed-07",
    name: "Dr. Eduardo Vale",
    specialty: "fisioterapia",
    credentialCode: "DEMO-CREFITO-FI-07",
    price: 160,
    workDays: [1, 2, 3, 4, 5, 6],
    startHour: "08:00",
    endHour: "18:00",
    bio: "Perfil fictício de fisioterapia, com sessões de demonstração em dias úteis e sábado.",
    tele: false,
  },
  {
    id: "pro-seed-08",
    name: "Dra. Sofia Andrade",
    specialty: "odontologia",
    credentialCode: "DEMO-CRO-OD-08",
    price: 240,
    workDays: [1, 3, 4, 5],
    startHour: "09:00",
    endHour: "17:00",
    bio: "Segunda cadeira odontológica fictícia, usada para mostrar filtro por especialidade e agenda individual.",
    tele: false,
  },
]

const PATIENT_NAMES = [
  "Helena Martins",
  "Miguel Andrade",
  "Laura Benevides",
  "Caio Tavares",
  "Nina Albuquerque",
  "Pedro Vasconcelos",
  "Alice Monteiro",
  "João Batista Demo",
  "Clara Figueiredo",
  "Heitor Lopes",
  "Manuela Ribeiro",
  "Davi Correia",
  "Luna Ferreira",
  "Arthur Moura",
  "Sofia Teixeira",
  "Bernardo Dias",
  "Isabela Cunha",
  "Theo Barros",
  "Valentina Nogueira",
  "Gael Martins",
  "Olívia Pacheco",
  "Samuel Vieira",
  "Aurora Lima",
  "Benício Rocha",
  "Cecília Duarte",
]

interface PlanItem {
  day: number
  time: string
  pro: number
  patient: number
  status: AppointmentStatus
  paid: boolean
}

function buildPlan(): PlanItem[] {
  const pastDays = [-150, -120, -100, -90, -75, -62, -55, -48, -40, -33, -28, -21, -18, -16, -10, -8, -6, -4]
  const past: PlanItem[] = pastDays.map((day, index) => {
    const status: AppointmentStatus =
      index === 4 || index === 11 ? "no-show" : index === 7 ? "cancelled" : "completed"
    return {
      day,
      time: ["08:00", "09:20", "10:40", "14:00", "15:20", "16:40"][index % 6] ?? "09:20",
      pro: index % 8,
      patient: (index % 24) + 1,
      status,
      paid: status === "completed",
    }
  })

  const featured: PlanItem[] = [
    { day: -14, time: "09:20", pro: 2, patient: 0, status: "completed", paid: true },
    { day: -3, time: "14:40", pro: 0, patient: 0, status: "cancelled", paid: false },
    { day: 1, time: "09:20", pro: 1, patient: 0, status: "scheduled", paid: false },
    { day: 0, time: "08:00", pro: 0, patient: 3, status: "completed", paid: true },
    { day: 0, time: "09:20", pro: 2, patient: 4, status: "completed", paid: true },
    { day: 0, time: "10:40", pro: 3, patient: 5, status: "confirmed", paid: true },
    { day: 0, time: "14:00", pro: 4, patient: 6, status: "confirmed", paid: false },
    { day: 0, time: "15:20", pro: 6, patient: 7, status: "scheduled", paid: false },
    { day: 0, time: "16:40", pro: 1, patient: 8, status: "scheduled", paid: false },
    { day: 1, time: "10:40", pro: 5, patient: 9, status: "confirmed", paid: true },
    { day: 2, time: "08:40", pro: 7, patient: 10, status: "scheduled", paid: false },
    { day: 3, time: "15:20", pro: 0, patient: 11, status: "scheduled", paid: false },
    { day: 4, time: "11:20", pro: 2, patient: 12, status: "confirmed", paid: false },
    { day: 6, time: "14:40", pro: 3, patient: 13, status: "scheduled", paid: false },
    { day: 7, time: "09:20", pro: 6, patient: 14, status: "scheduled", paid: false },
    { day: 9, time: "16:00", pro: 4, patient: 15, status: "scheduled", paid: false },
    { day: 12, time: "10:00", pro: 5, patient: 16, status: "scheduled", paid: false },
  ]

  return [...past, ...featured]
}

function buildProfessionals(anchor: string): Professional[] {
  return PROFESSIONAL_DRAFTS.map((draft, index) => {
    const reviews = [5, 4, 5].map((rating, reviewIndex) => ({
      id: `${draft.id}-review-${reviewIndex + 1}`,
      author: "Paciente de demonstração",
      rating,
      comment: "Avaliação fictícia criada para a apresentação comercial. Não representa uma opinião real.",
      date: anchor,
      demonstrative: true as const,
    }))
    const rating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    const services: Service[] = [
      {
        id: `${draft.id}-consulta`,
        name: "Consulta de demonstração",
        durationMin: 40,
        price: draft.price,
        modality: "presencial" as const,
      },
      {
        id: `${draft.id}-retorno`,
        name: "Retorno demonstrativo",
        durationMin: 40,
        price: Math.round(draft.price * 0.6),
        modality: "presencial" as const,
      },
    ]
    if (draft.tele) {
      services.push({
        id: `${draft.id}-tele`,
        name: "Teleconsulta demonstrativa",
        durationMin: 40,
        price: draft.price,
        modality: "teleconsulta",
      })
    }
    return {
      id: draft.id,
      name: draft.name,
      specialty: draft.specialty,
      credentialLabel: "Registro demonstrativo",
      credentialCode: draft.credentialCode,
      bio: draft.bio,
      price: draft.price,
      rating,
      reviewCount: reviews.length,
      reviews,
      workDays: draft.workDays,
      startHour: draft.startHour,
      endHour: draft.endHour,
      location: CLINIC_ADDRESS,
      services,
      active: true,
      avatarSeed: `${draft.name}-${index}`,
    }
  })
}

function buildPatients(now: Date): Patient[] {
  return PATIENT_NAMES.map((name, index) => {
    const sequence = String(index + 1).padStart(3, "0")
    return {
      id: `pat-seed-${sequence}`,
      name,
      cpf: `900.100.${sequence}-10`,
      phone: `(86) 99000-${String(1000 + index).padStart(4, "0")}`,
      email: `${name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z]+/g, ".")
        .replace(/^\.|\.$/g, "")}@demonstracao.demo`,
      birthDate: `${1978 + (index % 20)}-${String((index % 12) + 1).padStart(2, "0")}-15`,
      gender: index % 2 === 0 ? "Feminino" : "Masculino",
      address: `Rua da Demonstração, ${120 + index * 8}`,
      city: "Teresina - PI",
      status: index === 23 ? "inactive" : "active",
      notes: "Cadastro fictício para a demonstração. Não corresponde a uma pessoa real.",
      createdAt: formatISO(addDays(now, -90 + index)),
      reminderEnabled: true,
    }
  })
}

function resolveDay(today: Date, offset: number, workDays: number[]) {
  if (offset === 0) return today
  const step = offset < 0 ? -1 : 1
  let cursor = addDays(today, offset)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (workDays.includes(cursor.getDay())) return cursor
    cursor = addDays(cursor, step)
  }
  return addDays(today, offset)
}

function complaintFor(specialty: Specialty) {
  return `Registro fictício de ${SPECIALTY_LABEL[specialty].toLowerCase()}. Texto administrativo da demonstração, sem descrição clínica real.`
}

export function createSeed(now = new Date()): DemoData {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const anchorDate = toDateKey(today)
  const professionals = buildProfessionals(anchorDate)
  const patients = buildPatients(today)
  const appointments: DemoData["appointments"] = []
  const payments: DemoData["payments"] = []
  const records: DemoData["records"] = []
  const occupied = new Set<string>()

  buildPlan().forEach((item, index) => {
    const professional = professionals[item.pro]
    const patient = patients[item.patient]
    if (!professional || !patient) return
    const service = professional.services[0]
    if (!service) return
    let day = resolveDay(today, item.day, professional.workDays)
    let startsAt = combineDateAndTime(toDateKey(day), item.time)
    let guard = 0
    while (occupied.has(`${professional.id}-${startsAt.toISOString()}`) && guard < 6) {
      startsAt = addMinutes(startsAt, 40)
      day = startsAt
      guard += 1
    }
    occupied.add(`${professional.id}-${startsAt.toISOString()}`)
    const endsAt = addMinutes(startsAt, service.durationMin)
    const sequence = String(index + 1).padStart(2, "0")
    const appointmentId = `apt-seed-${sequence}`
    const shouldPay = item.status !== "cancelled"
    const paymentId = shouldPay ? `pay-seed-${sequence}` : undefined

    appointments.push({
      id: appointmentId,
      patientId: patient.id,
      professionalId: professional.id,
      serviceId: service.id,
      startsAt: formatISO(startsAt),
      endsAt: formatISO(endsAt),
      status: item.status,
      modality: service.modality,
      notes: "Consulta fictícia do roteiro comercial Saúde Prime.",
      createdAt: formatISO(addDays(startsAt, -2)),
      origin: "seed",
      paymentId,
    })

    if (paymentId) {
      const paid = item.paid
      payments.push({
        id: paymentId,
        appointmentId,
        patientId: patient.id,
        professionalId: professional.id,
        amount: service.price,
        method: index % 2 === 0 ? "pix" : "card",
        status: paid ? "paid" : "pending",
        createdAt: formatISO(addDays(startsAt, -2)),
        paidAt: paid ? formatISO(startsAt) : undefined,
        reference: `SP-DEMO-SEED${sequence}`,
        simulated: true,
        description: `${service.name} · ${professional.name}`,
      })
    }

    if (item.status === "completed") {
      const recordId = `rec-seed-${sequence}`
      records.push({
        id: recordId,
        patientId: patient.id,
        professionalId: professional.id,
        appointmentId,
        date: formatISO(startsAt),
        specialty: professional.specialty,
        complaint: complaintFor(professional.specialty),
        notes: "Anotação editável da demonstração. Salva apenas neste navegador.",
        evolution: "Evolução administrativa fictícia. Não descreve um quadro clínico real.",
        dentalNote:
          professional.specialty === "odontologia"
            ? "Campo odontológico de demonstração, pronto para observações fictícias da cadeira."
            : undefined,
        prescriptions: [
          {
            id: `${recordId}-rx`,
            label: "Item demonstrativo",
            instructions: "Não é uma prescrição. Texto reservado ao roteiro comercial.",
            demonstrative: true,
          },
        ],
        documents: [
          {
            id: `${recordId}-doc`,
            title: "Resumo administrativo de demonstração",
            kind: "Documento simulado",
            demonstrative: true,
          },
        ],
      })
    }
  })

  if (appointments.length !== 35) {
    throw new Error(`A demonstração esperava 35 consultas e gerou ${appointments.length}.`)
  }

  const blockDay = resolveDay(today, 2, professionals[0]?.workDays ?? [1, 2, 3, 4, 5])
  const blockStart = combineDateAndTime(toDateKey(blockDay), "11:20")

  return {
    schemaVersion: SCHEMA_VERSION,
    anchorDate,
    clinic: {
      name: "Saúde Prime",
      legalName: "Saúde Prime Demonstração Ltda.",
      city: "Teresina - PI",
      address: CLINIC_ADDRESS,
      phone: "(86) 90000-0100",
      email: "contato@demonstracao.demo",
    },
    professionals,
    patients,
    appointments,
    payments,
    records,
    blockedSlots: [
      {
        id: "block-seed-01",
        professionalId: "pro-seed-01",
        startsAt: formatISO(blockStart),
        endsAt: formatISO(addMinutes(blockStart, 40)),
        reason: "Bloqueio demonstrativo — reunião interna",
        origin: "seed",
      },
    ],
    currentPatientId: "pat-seed-001",
    readNotificationIds: [],
  }
}

export function emptyBooking() {
  return {
    professionalId: null,
    serviceId: null,
    date: null,
    time: null,
    rescheduleAppointmentId: null,
  }
}
