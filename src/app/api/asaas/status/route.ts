import { NextResponse } from "next/server"

import { hasClinicSession } from "@/lib/clinic-session"
import { asaasIntegrationStatus } from "@/lib/asaas/status"

export async function GET() {
  if (!(await hasClinicSession())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }
  return NextResponse.json(asaasIntegrationStatus())
}
