import { NextResponse } from "next/server"
import { hasClinicSession } from "@/lib/clinic-session"
import { cpfDigits } from "@/lib/cpf"
import { createId } from "@/lib/format"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { Patient, PatientInput } from "@/lib/types"
import { hasErrors, validatePatientInput } from "@/lib/validation"

const columns = "id,name,cpf,phone,email,birth_date,gender,address,city,status,notes,reminder_enabled,created_at"

type PatientRow = {
  id: string
  name: string
  cpf: string
  phone: string
  email: string
  birth_date: string
  gender: string
  address: string
  city: string
  status: "active" | "inactive"
  notes: string
  reminder_enabled: boolean
  created_at: string
}

function fromRow(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    cpf: row.cpf,
    phone: row.phone,
    email: row.email,
    birthDate: row.birth_date,
    gender: row.gender,
    address: row.address,
    city: row.city,
    status: row.status,
    notes: row.notes,
    reminderEnabled: row.reminder_enabled,
    createdAt: row.created_at,
  }
}

function toRow(id: string, form: PatientInput) {
  return {
    id,
    name: form.name.trim(),
    cpf: cpfDigits(form.cpf),
    phone: form.phone.trim(),
    email: form.email.trim().toLowerCase(),
    birth_date: form.birthDate,
    gender: form.gender.trim() || "Não informado",
    address: form.address.trim(),
    city: form.city.trim(),
    status: form.status,
    notes: form.notes.trim(),
    reminder_enabled: true,
  }
}

async function database() {
  if (!(await hasClinicSession())) return null
  return createSupabaseAdmin()
}

export async function GET() {
  const db = await database()
  if (!db) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })

  const { data, error } = await db.from("patients").select(columns).order("name")
  if (error) return NextResponse.json({ error: "Não foi possível carregar os pacientes." }, { status: 500 })
  return NextResponse.json({ patients: (data as PatientRow[]).map(fromRow) })
}

export async function POST(request: Request) {
  const db = await database()
  if (!db) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })

  try {
    const body = await request.json() as { id?: string; form?: PatientInput }
    if (!body.form || hasErrors(validatePatientInput(body.form))) {
      return NextResponse.json({ error: "Confira os dados do paciente." }, { status: 422 })
    }
    const id = body.id?.trim() || createId("pat")
    const { data, error } = await db.from("patients").insert(toRow(id, body.form)).select(columns).single()
    if (error || !data) return NextResponse.json({ error: "Não foi possível salvar o paciente. Confira se CPF ou e-mail já estão cadastrados." }, { status: 409 })
    return NextResponse.json({ patient: fromRow(data as PatientRow) })
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar o paciente." }, { status: 422 })
  }
}

export async function PATCH(request: Request) {
  const db = await database()
  if (!db) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })

  try {
    const body = await request.json() as { id?: string; form?: PatientInput }
    const id = body.id?.trim()
    if (!id || !body.form || hasErrors(validatePatientInput(body.form))) {
      return NextResponse.json({ error: "Confira os dados do paciente." }, { status: 422 })
    }
    const { data, error } = await db.from("patients").update(toRow(id, body.form)).eq("id", id).select(columns).maybeSingle()
    if (error) return NextResponse.json({ error: "Não foi possível atualizar o paciente. Confira se CPF ou e-mail já estão cadastrados." }, { status: 409 })
    if (!data) return NextResponse.json({ error: "Paciente não encontrado no banco." }, { status: 404 })
    return NextResponse.json({ patient: fromRow(data as PatientRow) })
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o paciente." }, { status: 422 })
  }
}
