import "server-only"

import { asaasEnvironment, isAsaasConfigured, isAsaasWebhookConfigured } from "@/lib/asaas/config"
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export function asaasIntegrationStatus() {
  return {
    ready: isAsaasConfigured() && isAsaasWebhookConfigured() && isSupabaseAdminConfigured(),
    asaas: {
      configured: isAsaasConfigured(),
      environment: asaasEnvironment(),
    },
    webhook: {
      tokenConfigured: isAsaasWebhookConfigured(),
      path: "/api/asaas/webhook",
    },
    supabaseAdmin: {
      configured: isSupabaseAdminConfigured(),
    },
  }
}
