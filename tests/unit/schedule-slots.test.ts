import { describe, expect, it } from "vitest"
import { availableSlots } from "@/lib/schedule"
import type { Appointment, BlockedSlot, Professional, Service } from "@/lib/types"

const mockProfessional: Professional = {
  id: "pro-1",
  name: "Dr. Roberto",
  specialty: "clinica-geral",
  credentialLabel: "CRM",
  credentialCode: "12345",
  bio: "Médico clínico",
  price: 150,
  rating: 5,
  reviewCount: 10,
  reviews: [],
  workDays: [1, 2, 3, 4, 5], // Seg a Sex
  startHour: "08:00",
  endHour: "12:00",
  location: "Sala 1",
  active: true,
  avatarSeed: "roberto",
  services: [
    {
      id: "svc-1",
      name: "Consulta Geral",
      durationMin: 40,
      price: 150,
      modality: "presencial",
    },
  ],
}

const mockService: Service = mockProfessional.services[0]

describe("availableSlots e conflitos de horários ocupados", () => {
  it("não exibe o horário se já houver consulta agendada ou confirmada", () => {
    // 2026-11-02 é uma segunda-feira
    const now = new Date("2026-11-01T08:00:00-03:00")
    const dateKey = "2026-11-02"

    const bookedAppointment: Appointment = {
      id: "apt-booked",
      patientId: "patient-1",
      professionalId: "pro-1",
      serviceId: "svc-1",
      startsAt: "2026-11-02T08:00:00-03:00",
      endsAt: "2026-11-02T08:40:00-03:00",
      status: "scheduled",
      modality: "presencial",
      notes: "",
      origin: "mobile",
      createdAt: "2026-11-01T08:00:00-03:00",
    }

    const slotsBeforeCancel = availableSlots({
      professional: mockProfessional,
      service: mockService,
      dateKey,
      appointments: [bookedAppointment],
      blockedSlots: [],
      now,
    })

    // 08:00 está ocupado por consulta agendada
    expect(slotsBeforeCancel.some((s) => s.time === "08:00")).toBe(false)
    expect(slotsBeforeCancel.some((s) => s.time === "08:40")).toBe(true)
  })

  it("volta a exibir o horário quando a consulta for cancelada", () => {
    const now = new Date("2026-11-01T08:00:00-03:00")
    const dateKey = "2026-11-02"

    const cancelledAppointment: Appointment = {
      id: "apt-cancelled",
      patientId: "patient-1",
      professionalId: "pro-1",
      serviceId: "svc-1",
      startsAt: "2026-11-02T08:00:00-03:00",
      endsAt: "2026-11-02T08:40:00-03:00",
      status: "cancelled", // Consulta cancelada
      modality: "presencial",
      notes: "",
      origin: "mobile",
      createdAt: "2026-11-01T08:00:00-03:00",
    }

    const slotsAfterCancel = availableSlots({
      professional: mockProfessional,
      service: mockService,
      dateKey,
      appointments: [cancelledAppointment],
      blockedSlots: [],
      now,
    })

    // Com o status "cancelled", o horário 08:00 volta a aparecer livre!
    expect(slotsAfterCancel.some((s) => s.time === "08:00")).toBe(true)
  })
})

