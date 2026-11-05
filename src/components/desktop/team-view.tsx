"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { FadeIn } from "@/components/shared/fade-in"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import type { ClinicRole, ClinicTeamMember } from "@/lib/types"

interface NewMemberForm {
  name: string
  email: string
  role: ClinicRole
  password: string
}

const initialForm: NewMemberForm = {
  name: "",
  email: "",
  role: "attendant",
  password: "",
}

export function TeamView() {
  const [members, setMembers] = useState<ClinicTeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "attendant">("all")

  // Modal de cadastro
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<NewMemberForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)

  // Status toggle
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function loadTeam() {
    setLoading(true)
    setLoadError("")
    try {
      const res = await fetch("/api/desktop/team", { cache: "no-store" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Não foi possível carregar a equipe.")
      }
      const data: ClinicTeamMember[] = await res.json()
      setMembers(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro desconhecido ao carregar equipe.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTeam()
  }, [])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((member) => {
      const matchesSearch =
        !q ||
        member.name.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q)
      const matchesRole = roleFilter === "all" || member.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [members, search, roleFilter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 3) {
      toast.error("O nome deve ter no mínimo 3 caracteres.")
      return
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(form.email.trim())) {
      toast.error("Informe um e-mail válido.")
      return
    }
    if (form.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/desktop/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          password: form.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível criar o membro da equipe.")
      }
      toast.success("Membro da equipe cadastrado com sucesso!")
      if (data.member) {
        setMembers((prev) => [data.member, ...prev])
      }
      setDialogOpen(false)
      setForm(initialForm)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar membro.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleStatus(member: ClinicTeamMember) {
    const nextStatus = member.status === "active" ? "inactive" : "active"
    setTogglingId(member.id)
    try {
      const res = await fetch("/api/desktop/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível alterar o status.")
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, status: nextStatus } : m))
      )
      toast.success(
        nextStatus === "active"
          ? `Acesso de ${member.name} ativado!`
          : `Acesso de ${member.name} desativado!`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar status.")
    } finally {
      setTogglingId(null)
    }
  }

  const activeCount = members.filter((m) => m.status === "active").length
  const attendantCount = members.filter((m) => m.role === "attendant").length
  const adminCount = members.filter((m) => m.role === "admin").length

  return (
    <FadeIn className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Administração</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os usuários do painel, perfis de acesso e status de ativação da equipe.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadTeam}
            disabled={loading}
            aria-label="Atualizar lista"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            type="button"
            onClick={() => {
              setForm(initialForm)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4 mr-1.5" />
            Novo membro da equipe
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total da Equipe</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{members.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Membros Ativos</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">{activeCount}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Recepção / Atendentes</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{attendantCount}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Administradores</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-teal-700">{adminCount}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={roleFilter}
            onValueChange={(val: "all" | "admin" | "attendant") => setRoleFilter(val)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papéis</SelectItem>
              <SelectItem value="attendant">Atendentes</SelectItem>
              <SelectItem value="admin">Administradores</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mensagem de Erro de Carregamento */}
      {loadError && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <p>{loadError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={loadTeam}
            className="ml-auto text-destructive hover:bg-destructive/10"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Tabela de Membros */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {loading && members.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-2">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando membros da equipe...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || roleFilter !== "all" ? "Nenhum membro encontrado" : "Nenhum membro cadastrado"}
            description={
              search || roleFilter !== "all"
                ? "Ajuste os filtros de busca para encontrar o membro desejado."
                : "Cadastre recepcionistas e administradores para gerenciar o acesso à clínica."
            }
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setRoleFilter("all")
                  if (members.length === 0) setDialogOpen(true)
                }}
              >
                {members.length === 0 ? "Cadastrar primeiro membro" : "Limpar filtros"}
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Cadastrado em</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                const isToggling = togglingId === member.id
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-sm text-foreground">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{member.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.role === "admin" ? (
                        <Badge variant="default" className="gap-1 bg-teal-800 text-teal-50">
                          <ShieldCheck className="size-3" />
                          Administrador
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <User className="size-3" />
                          Atendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                          Inativo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {formatDate(member.createdAt, "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isToggling}
                        onClick={() => handleToggleStatus(member)}
                        className={
                          member.status === "active"
                            ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                            : "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                        }
                      >
                        {isToggling ? (
                          <Loader2 className="size-3.5 animate-spin mr-1" />
                        ) : member.status === "active" ? (
                          <UserX className="size-3.5 mr-1" />
                        ) : (
                          <UserCheck className="size-3.5 mr-1" />
                        )}
                        {member.status === "active" ? "Desativar" : "Ativar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal "+ Novo membro da equipe" */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Novo membro da equipe</DialogTitle>
              <DialogDescription>
                Crie um novo acesso ao painel desktop com login por e-mail e senha.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label htmlFor="member-name" className="text-xs font-medium text-foreground">
                  Nome completo
                </label>
                <Input
                  id="member-name"
                  placeholder="Ex: Ana Clara Rodrigues"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="member-email" className="text-xs font-medium text-foreground">
                  E-mail institucional
                </label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="ana.recepcao@clinicamais.com.br"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="member-role" className="text-xs font-medium text-foreground">
                  Papel de acesso
                </label>
                <Select
                  value={form.role}
                  onValueChange={(val: ClinicRole) => setForm({ ...form, role: val })}
                >
                  <SelectTrigger id="member-role" className="w-full">
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendant">
                      <div className="flex flex-col py-0.5 text-left">
                        <span className="font-medium">Atendente (Recepção)</span>
                        <span className="text-xs text-muted-foreground">
                          Acesso à agenda, pacientes, guias e consultas
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col py-0.5 text-left">
                        <span className="font-medium">Administrador</span>
                        <span className="text-xs text-muted-foreground">
                          Acesso total a financeiro, gestão da equipe e regras
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="member-password" className="text-xs font-medium text-foreground">
                  Senha inicial
                </label>
                <Input
                  id="member-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  O colaborador usará esta senha para entrar no painel da clínica.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                    Cadastrando...
                  </>
                ) : (
                  "Cadastrar membro"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </FadeIn>
  )
}
