import { NextResponse } from "next/server"

import { persistAsaasWebhook, webhookTokenMatches } from "@/lib/asaas/webhooks"
import type { AsaasWebhookPayload } from "@/lib/asaas/types"
import { isAsaasWebhookConfigured } from "@/lib/asaas/config"
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  if (!isAsaasWebhookConfigured()) {
    return NextResponse.json({ error: "Token do webhook ainda não foi configurado." }, { status: 503 })
  }

  const token = request.headers.get("asaas-access-token")
  if (!webhookTokenMatches(token)) {
    return NextResponse.json({ error: "Token do webhook inválido." }, { status: 401 })
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Service role do Supabase ainda não foi configurada para persistir o evento." },
      { status: 503 },
    )
  }

  let payload: AsaasWebhookPayload
  try {
    payload = (await request.json()) as AsaasWebhookPayload
  } catch {
    return NextResponse.json({ error: "Corpo do webhook inválido." }, { status: 400 })
  }

  try {
    const result = await persistAsaasWebhook(payload)
    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gravar o webhook."
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
