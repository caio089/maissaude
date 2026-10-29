import { NextResponse } from "next/server"

import { getCartQuote, type CartPaymentLineInput } from "@/lib/payments/cart-quote"
import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const patient = await requireCurrentPatient()
    const body = (await request.json()) as { lines?: CartPaymentLineInput[] }
    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })

    return NextResponse.json(await getCartQuote(admin, patient.cpf, body.lines))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível conferir o pagamento." },
      { status: error instanceof PaymentAuthorizationError ? 401 : 422 },
    )
  }
}
