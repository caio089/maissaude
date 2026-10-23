export const CLINIC_AUTH_EMAIL = "maissaude2026@gmail.com"
export const AUTH_PASSWORD_MIN = 6

export type AuthRole = "clinic" | "patient"

export function isClinicRole(role: unknown) {
  return role === "clinic"
}

export function isPatientRole(role: unknown) {
  return role === "patient"
}
