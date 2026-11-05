import { NextResponse } from "next/server"
import { getClinicSession } from "@/lib/clinic-session"

export async function GET() {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  if (session.role === "attendant") {
    return NextResponse.json({ error: "Módulo financeiro restrito à administração." }, { status: 403 })
  }
  return NextResponse.json({ entries: [] })
}

export async function POST(request: Request) {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  if (session.role === "attendant") {
    return NextResponse.json({ error: "Módulo financeiro restrito à administração." }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
