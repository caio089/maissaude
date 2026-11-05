import { describe, expect, it } from "vitest"
import { getAppointmentProfessionalName } from "@/components/desktop/patients-view"

describe("getAppointmentProfessionalName helper", () => {
  it("retorna 'Geral da Clínica' quando professionalId for nulo, indefinido ou vazio", () => {
    expect(getAppointmentProfessionalName(null)).toBe("Geral da Clínica")
    expect(getAppointmentProfessionalName(undefined)).toBe("Geral da Clínica")
    expect(getAppointmentProfessionalName("")).toBe("Geral da Clínica")
    expect(getAppointmentProfessionalName(null, "Dr. Qualquer")).toBe("Geral da Clínica")
  })

  it("retorna o nome do médico quando fornecido e professionalId existir", () => {
    expect(getAppointmentProfessionalName("pro-1", "Dra. Paula Pediatra")).toBe("Dra. Paula Pediatra")
    expect(getAppointmentProfessionalName("pro-2", "Dr. João Cardiologista")).toBe("Dr. João Cardiologista")
  })

  it("retorna 'Não informado' quando houver professionalId mas o profissional não for encontrado ou não tiver nome", () => {
    expect(getAppointmentProfessionalName("pro-deletado", null)).toBe("Não informado")
    expect(getAppointmentProfessionalName("pro-deletado", undefined)).toBe("Não informado")
    expect(getAppointmentProfessionalName("pro-deletado", "")).toBe("Não informado")
  })
})
