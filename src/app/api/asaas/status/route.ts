import { NextResponse } from "next/server"

import { asaasIntegrationStatus } from "@/lib/asaas/status"

export async function GET() {
  return NextResponse.json(asaasIntegrationStatus())
}
