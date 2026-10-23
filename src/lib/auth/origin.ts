import "server-only"

import { headers } from "next/headers"
import { isProductionRuntime } from "@/lib/runtime"

export async function requestOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "")
  if (configured) return configured
  if (isProductionRuntime()) return ""
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") || headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") || "https"
  if (host) return `${proto}://${host}`
  return "http://localhost:3000"
}
