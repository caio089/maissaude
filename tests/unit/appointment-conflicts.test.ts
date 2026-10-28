import { describe, expect, it } from "vitest"
import { APPOINTMENT_CONFLICT_MESSAGE, AppointmentConflictError, isAppointmentConflictError } from "@/lib/appointments/conflicts"

describe("proteção contra dois agendamentos no mesmo horário", () => {
  it("reconhece o código de conflito do Postgres", () => {
    expect(isAppointmentConflictError({ code: "23P01", message: "exclusion constraint" })).toBe(true)
  })

  it("reconhece a restrição sem expor detalhes do banco", () => {
    expect(isAppointmentConflictError({ message: "violates appointments_no_overlapping_active_slots" })).toBe(true)
    expect(new AppointmentConflictError().message).toBe(APPOINTMENT_CONFLICT_MESSAGE)
  })

  it("não confunde outros erros com horário ocupado", () => {
    expect(isAppointmentConflictError({ code: "23503", message: "foreign key" })).toBe(false)
  })
})
