import "server-only"

import { headers } from "next/headers"

export async function requestOrigin() {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") || headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") || "http"
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"
}
