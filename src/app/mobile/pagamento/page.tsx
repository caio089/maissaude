import type { Metadata } from "next"
import { PaymentView } from "@/components/mobile/payment-view"

export const metadata: Metadata = { title: "Pagamento" }

export default function PaymentPage() {
  return <PaymentView />
}
