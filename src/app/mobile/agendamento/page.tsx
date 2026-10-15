import type { Metadata } from "next"
import { BookingView } from "@/components/mobile/booking-view"

export const metadata: Metadata = { title: "Agendamento" }

export default function BookingPage() {
  return <BookingView />
}
