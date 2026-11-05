import { NextResponse } from "next/server"
import { getClinicSession } from "@/lib/clinic-session"

export async function GET() {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ authenticated: false, error: "Não autenticado." }, { status: 401 })
  }
  return NextResponse.json(session)
}
