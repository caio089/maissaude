import type { DemoData, Patient, Professional } from "@/lib/types"

export const TEST_PATIENT: Patient = {
  id: "pat-test-mobile",
  name: "Maria Teste",
  cpf: "529.982.247-25",
  phone: "(86) 99999-0000",
  email: "maria.teste@example.com",
  birthDate: "1990-05-12",
  gender: "Feminino",
  address: "Rua dos Testes, 100",
  city: "Teresina - PI",
  status: "active",
  notes: "Paciente exclusivo dos testes automatizados.",
  createdAt: "2026-01-01T12:00:00.000Z",
  reminderEnabled: true,
}

export const TEST_PROFESSIONALS: Professional[] = [
  {
    id: "pro-test-mobile",
    name: "Dra. Ana Teste",
    specialty: "clinica-geral",
    credentialLabel: "CRM",
    credentialCode: "12345-PI",
    bio: "Profissional exclusiva dos testes automatizados.",
    price: 120,
    rating: 4.9,
    reviewCount: 42,
    reviews: [],
    workDays: [0, 1, 2, 3, 4, 5, 6],
    startHour: "08:00",
    endHour: "18:00",
    location: "Unidade Centro",
    active: true,
    avatarSeed: "ana-testes",
    services: [
      { id: "svc-consulta-presencial", name: "Consulta", durationMin: 40, price: 120, modality: "presencial", kind: "consulta" },
      { id: "svc-consulta-video", name: "Teleconsulta", durationMin: 40, price: 100, modality: "teleconsulta", kind: "consulta" },
      { id: "svc-exame", name: "Avaliação clínica", durationMin: 40, price: 80, modality: "presencial", kind: "exame" },
      { id: "svc-cirurgia", name: "Pequeno procedimento", durationMin: 40, price: 300, modality: "presencial", kind: "cirurgia" },
    ],
  },
]

export function testData(anchorDate: string): DemoData {
  return {
    schemaVersion: 2,
    anchorDate,
    clinic: {
      name: "CuidarSaude",
      legalName: "",
      city: "Teresina - PI",
      address: "",
      phone: "",
      email: "",
    },
    professionals: TEST_PROFESSIONALS,
    patients: [TEST_PATIENT],
    appointments: [],
    payments: [],
    records: [],
    blockedSlots: [],
    currentPatientId: TEST_PATIENT.id,
    readNotificationIds: [],
  }
}
