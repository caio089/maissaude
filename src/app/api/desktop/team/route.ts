import { NextResponse } from "next/server"
import { getClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { ClinicRole, ClinicTeamMember } from "@/lib/types"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function verifyAdminAuth() {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return {
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    }
  }

  if (session.role !== "admin") {
    return {
      errorResponse: NextResponse.json(
        { error: "Apenas administradores podem gerenciar a equipe." },
        { status: 403 }
      ),
    }
  }

  const db = createSupabaseAdmin()
  if (!db) {
    return {
      errorResponse: NextResponse.json(
        { error: "Banco de dados indisponível." },
        { status: 503 }
      ),
    }
  }

  return { db, session }
}

export async function GET() {
  const auth = await verifyAdminAuth()
  if (auth.errorResponse) return auth.errorResponse
  const { db } = auth

  const { data, error } = await db
    .from("clinic_team")
    .select("id, auth_user_id, name, email, role, status, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível carregar a equipe." },
      { status: 500 }
    )
  }

  const members: ClinicTeamMember[] = (data || []).map((row: any) => ({
    id: row.id,
    authUserId: row.auth_user_id ?? null,
    name: row.name,
    email: row.email,
    role: row.role as ClinicRole,
    status: row.status as "active" | "inactive",
    createdAt: row.created_at,
  }))

  return NextResponse.json(members)
}

export async function POST(request: Request) {
  const auth = await verifyAdminAuth()
  if (auth.errorResponse) return auth.errorResponse
  const { db } = auth

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    )
  }

  const { name, email, password, role } = body || {}

  if (
    typeof name !== "string" ||
    name.trim().length < 3 ||
    typeof email !== "string" ||
    !EMAIL_PATTERN.test(email.trim()) ||
    typeof password !== "string" ||
    password.length < 6 ||
    (role !== "admin" && role !== "attendant")
  ) {
    return NextResponse.json(
      {
        error:
          "Preencha nome (mínimo 3 caracteres), e-mail válido, senha (mínimo 6 caracteres) e papel (admin ou attendant).",
      },
      { status: 400 }
    )
  }

  const cleanEmail = email.trim().toLowerCase()
  const cleanName = name.trim()

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    app_metadata: { role: "clinic", clinic_role: role },
    user_metadata: { name: cleanName },
  })

  if (authError) {
    return NextResponse.json(
      { error: authError.message || "Não foi possível criar o usuário no Auth." },
      { status: 400 }
    )
  }

  const { data: teamMember, error: insertError } = await db
    .from("clinic_team")
    .insert({
      auth_user_id: authData?.user?.id ?? null,
      name: cleanName,
      email: cleanEmail,
      role,
      status: "active",
    })
    .select("id, auth_user_id, name, email, role, status, created_at")
    .single()

  if (insertError) {
    if (authData?.user?.id && db.auth?.admin?.deleteUser) {
      await db.auth.admin.deleteUser(authData.user.id).catch(() => {})
    }
    return NextResponse.json(
      { error: insertError.message || "Não foi possível registrar o membro na equipe." },
      { status: 500 }
    )
  }

  const member: ClinicTeamMember = {
    id: teamMember.id,
    authUserId: teamMember.auth_user_id ?? null,
    name: teamMember.name,
    email: teamMember.email,
    role: teamMember.role as ClinicRole,
    status: teamMember.status as "active" | "inactive",
    createdAt: teamMember.created_at,
  }

  return NextResponse.json({ ok: true, member }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminAuth()
  if (auth.errorResponse) return auth.errorResponse
  const { db } = auth

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    )
  }

  const { id, status, name } = body || {}

  if (!id || typeof id !== "string" || !id.trim()) {
    return NextResponse.json(
      { error: "ID do membro da equipe é obrigatório." },
      { status: 400 }
    )
  }

  if (status === undefined && name === undefined) {
    return NextResponse.json(
      { error: "Informe ao menos um campo para atualização (status ou nome)." },
      { status: 400 }
    )
  }

  if (status !== undefined && status !== "active" && status !== "inactive") {
    return NextResponse.json(
      { error: "Status inválido. Use 'active' ou 'inactive'." },
      { status: 400 }
    )
  }

  if (name !== undefined && (typeof name !== "string" || name.trim().length < 3)) {
    return NextResponse.json(
      { error: "Nome deve ter ao menos 3 caracteres." },
      { status: 400 }
    )
  }

  if (status === "inactive" && auth.session.email) {
    const table = db.from("clinic_team")
    if (typeof table.select === "function") {
      const { data: targetMember } = await table
        .select("email")
        .eq("id", id.trim())
        .single()
      if (targetMember && targetMember.email.toLowerCase() === auth.session.email.toLowerCase()) {
        return NextResponse.json(
          { error: "Você não pode desativar seu próprio acesso de administrador." },
          { status: 400 }
        )
      }
    }
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }
  if (status !== undefined) {
    updatePayload.status = status
  }
  if (name !== undefined) {
    updatePayload.name = name.trim()
  }

  const { data: updated, error: updateError } = await db
    .from("clinic_team")
    .update(updatePayload)
    .eq("id", id.trim())
    .select("id, auth_user_id, name, email, role, status, created_at")
    .single()

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Não foi possível atualizar o membro da equipe." },
      { status: 500 }
    )
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Membro da equipe não encontrado." },
      { status: 404 }
    )
  }

  if (status !== undefined && updated.auth_user_id && db.auth?.admin?.updateUserById) {
    await db.auth.admin
      .updateUserById(updated.auth_user_id, {
        ban_duration: status === "inactive" ? "876000h" : "none",
      })
      .catch(() => {})
  }

  const member: ClinicTeamMember = {
    id: updated.id,
    authUserId: updated.auth_user_id ?? null,
    name: updated.name,
    email: updated.email,
    role: updated.role as ClinicRole,
    status: updated.status as "active" | "inactive",
    createdAt: updated.created_at,
  }

  return NextResponse.json({ ok: true, member })
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminAuth()
  if (auth.errorResponse) return auth.errorResponse
  const { db } = auth

  const { searchParams } = new URL(request.url)
  let id = searchParams.get("id")?.trim()

  if (!id) {
    try {
      const body = await request.json()
      id = body?.id?.trim()
    } catch {}
  }

  if (!id) {
    return NextResponse.json(
      { error: "ID do membro da equipe é obrigatório." },
      { status: 400 }
    )
  }

  const { data: member, error: findError } = await db
    .from("clinic_team")
    .select("id, auth_user_id, email, name, role")
    .eq("id", id)
    .maybeSingle()

  if (findError || !member) {
    return NextResponse.json(
      { error: "Membro da equipe não encontrado." },
      { status: 404 }
    )
  }

  if (auth.session.email && member.email.toLowerCase() === auth.session.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Você não pode excluir seu próprio usuário de administrador." },
      { status: 400 }
    )
  }

  if (member.email.toLowerCase() === "cuidarsaude2026@gmail.com") {
    return NextResponse.json(
      { error: "A conta principal da clínica não pode ser excluída." },
      { status: 400 }
    )
  }

  const { error: deleteError } = await db
    .from("clinic_team")
    .delete()
    .eq("id", id)

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Não foi possível excluir o membro da equipe." },
      { status: 500 }
    )
  }

  if (member.auth_user_id && db.auth?.admin?.deleteUser) {
    await db.auth.admin.deleteUser(member.auth_user_id).catch(() => {})
  }

  return NextResponse.json({ ok: true, id, message: "Membro da equipe excluído com sucesso." })
}
