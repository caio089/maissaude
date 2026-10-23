import { toDateKey } from "@/lib/format"
import { SCHEMA_VERSION, type DemoData } from "@/lib/types"

/** Estado inicial de uma unidade nova, sem registros de exemplo. */
export function createSeed(now = new Date()): DemoData {
  return {
    schemaVersion: SCHEMA_VERSION,
    anchorDate: toDateKey(now),
    clinic: {
      name: "CuidarSaude",
      legalName: "",
      city: "",
      address: "",
      phone: "",
      email: "",
    },
    professionals: [],
    patients: [],
    appointments: [],
    payments: [],
    records: [],
    blockedSlots: [],
    currentPatientId: "",
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
