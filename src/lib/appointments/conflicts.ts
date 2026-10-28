export const APPOINTMENT_CONFLICT_MESSAGE = "Esse horário acabou de ser reservado. Escolha outro horário."

type DatabaseError = {
  code?: string | null
  message?: string | null
  details?: string | null
}

export function isAppointmentConflictError(error: DatabaseError | null | undefined) {
  if (!error) return false
  const text = `${error.message || ""} ${error.details || ""}`
  return error.code === "23P01" || text.includes("appointments_no_overlapping_active_slots")
}

export class AppointmentConflictError extends Error {
  constructor() {
    super(APPOINTMENT_CONFLICT_MESSAGE)
    this.name = "AppointmentConflictError"
  }
}
