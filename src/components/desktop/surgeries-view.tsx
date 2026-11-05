"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Building2, Clock, Plus, Search, ShieldAlert, Stethoscope } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatMoney, createId } from "@/lib/format"
import { ASAAS_PIX_MINIMUM } from "@/lib/asaas/minimums"
import { useDemoStore } from "@/lib/store"
import type { ClinicRole, Professional, Service } from "@/lib/types"

export interface SurgeryItem {
  id: string
  name: string
  kind: string
  professionalId: string | null
  price: number
  durationMin: number
}

export interface SurgeryMetrics {
  total: number
  averageDurationMin: number
  withDoctorCount: number
  clinicCount: number
}

export interface SurgeriesViewProps {
  initialRole?: ClinicRole
  initialSurgeries?: SurgeryItem[]
  initialProfessionals?: Professional[]
  initialDiscountPercent?: number
}

export function canManageSurgeries(role?: ClinicRole | null): boolean {
  return role !== "attendant"
}

export function getSurgeriesViewMode(role?: ClinicRole | null): {
  isReadOnly: boolean
  badgeLabel: string | null
} {
  const isReadOnly = role === "attendant"
  return {
    isReadOnly,
    badgeLabel: isReadOnly ? "Modo somente leitura" : null,
  }
}

export function computeSurgeryMetrics(surgeries: SurgeryItem[]): SurgeryMetrics {
  const total = surgeries.length
  if (total === 0) {
    return {
      total: 0,
      averageDurationMin: 0,
      withDoctorCount: 0,
      clinicCount: 0,
    }
  }

  const totalDuration = surgeries.reduce((sum, item) => sum + (item.durationMin || 0), 0)
  const averageDurationMin = Math.round(totalDuration / total)
  const withDoctorCount = surgeries.filter((item) => Boolean(item.professionalId)).length
  const clinicCount = surgeries.filter((item) => !item.professionalId).length

  return {
    total,
    averageDurationMin,
    withDoctorCount,
    clinicCount,
  }
}

export function calculateAssociateSurgeryPrice(price: number, discountPercent: number): number {
  if (discountPercent <= 0) return price
  const discounted = price * (1 - discountPercent / 100)
  return Math.round(discounted * 100) / 100
}

export function filterSurgeries(
  surgeries: SurgeryItem[],
  query: string,
  filterType: "all" | "clinic" | "doctor",
  professionalsMap?: Map<string, string>
): SurgeryItem[] {
  const normalizedQuery = query.trim().toLowerCase()

  return surgeries.filter((surgery) => {
    // Type filter
    if (filterType === "clinic" && surgery.professionalId) return false
    if (filterType === "doctor" && !surgery.professionalId) return false

    // Text search
    if (!normalizedQuery) return true
    const nameMatch = surgery.name.toLowerCase().includes(normalizedQuery)
    const doctorName = surgery.professionalId && professionalsMap
      ? (professionalsMap.get(surgery.professionalId) || "").toLowerCase()
      : ""
    const doctorMatch = doctorName.includes(normalizedQuery)

    return nameMatch || doctorMatch
  })
}

export function SurgeriesView({
  initialRole,
  initialSurgeries,
  initialProfessionals,
  initialDiscountPercent,
}: SurgeriesViewProps = {}) {
  const [role, setRole] = useState<ClinicRole | null>(initialRole ?? null)
  const localProfessionals = useDemoStore((state) => state.data.professionals)
  const storeAssociateDiscount = useDemoStore((state) => state.associateRules.consultationDiscountPercent)
  const associateDiscountPercent = initialDiscountPercent ?? storeAssociateDiscount ?? 20

  const [surgeries, setSurgeries] = useState<SurgeryItem[]>(initialSurgeries ?? [])
  const [serverProfessionals, setServerProfessionals] = useState<Professional[]>(initialProfessionals ?? [])
  const [loading, setLoading] = useState(!initialSurgeries)
  const [error, setError] = useState("")

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [responsibleFilter, setResponsibleFilter] = useState<"all" | "clinic" | "doctor">("all")

  // Create Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    durationMin: 60,
    price: 500,
    professionalId: "",
  })

  // Role permissions
  const canManage = canManageSurgeries(role)
  const viewMode = getSurgeriesViewMode(role)

  // Fetch session role if not provided
  useEffect(() => {
    if (initialRole) {
      setRole(initialRole)
      return
    }
    let active = true
    fetch("/api/desktop/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.authenticated) setRole(data.role)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [initialRole])

  // Refresh surgeries list
  async function refreshSurgeries() {
    try {
      const res = await fetch("/api/desktop/services?kind=cirurgia", { cache: "no-store" })
      const data = (await res.json()) as { offers?: SurgeryItem[]; error?: string }
      if (!res.ok) throw new Error(data.error || "Não foi possível carregar as cirurgias.")
      const list = (data.offers || []).filter((item) => item.kind === "cirurgia")
      setSurgeries(list)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar procedimentos cirúrgicos.")
    }
  }

  // Refresh professionals list
  async function refreshProfessionals() {
    try {
      const res = await fetch("/api/desktop/professionals", { cache: "no-store" })
      const data = (await res.json()) as { professionals?: Professional[]; error?: string }
      if (!res.ok) throw new Error(data.error || "Não foi possível carregar os profissionais.")
      setServerProfessionals(data.professionals || [])
    } catch {
      // Keep local professionals fallback
    }
  }

  // Initial data loading
  useEffect(() => {
    if (initialSurgeries && initialProfessionals) {
      setLoading(false)
      return
    }
    const controller = new AbortController()

    Promise.allSettled([
      fetch("/api/desktop/services?kind=cirurgia", { cache: "no-store", signal: controller.signal })
        .then(async (res) => {
          const data = (await res.json()) as { offers?: SurgeryItem[]; error?: string }
          if (!res.ok) throw new Error(data.error || "Não foi possível carregar as cirurgias.")
          if (!controller.signal.aborted) {
            const list = (data.offers || []).filter((item) => item.kind === "cirurgia")
            setSurgeries(list)
          }
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : "Erro ao carregar procedimentos cirúrgicos.")
          }
        }),

      fetch("/api/desktop/professionals", { cache: "no-store", signal: controller.signal })
        .then(async (res) => {
          const data = (await res.json()) as { professionals?: Professional[]; error?: string }
          if (!res.ok) throw new Error(data.error || "Não foi possível carregar os profissionais.")
          if (!controller.signal.aborted) {
            setServerProfessionals(data.professionals || [])
          }
        })
        .catch(() => {}),
    ]).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    return () => controller.abort()
  }, [initialSurgeries, initialProfessionals])

  // Combine professionals map
  const allProfessionals = useMemo(() => {
    const map = new Map<string, Professional>()
    for (const p of localProfessionals) map.set(p.id, p)
    for (const p of serverProfessionals) map.set(p.id, p)
    return [...map.values()]
  }, [localProfessionals, serverProfessionals])

  const professionalsMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of allProfessionals) {
      map.set(p.id, p.name)
    }
    return map
  }, [allProfessionals])

  // KPIs
  const metrics = useMemo(() => computeSurgeryMetrics(surgeries), [surgeries])

  // Filtered surgeries
  const filteredSurgeries = useMemo(() => {
    return filterSurgeries(surgeries, searchQuery, responsibleFilter, professionalsMap)
  }, [surgeries, searchQuery, responsibleFilter, professionalsMap])

  // Create Surgery submission
  async function handleCreateSurgery(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) {
      toast.error("Atendentes possuem acesso somente leitura aos procedimentos.")
      return
    }

    const trimmedName = formData.name.trim()
    if (!trimmedName || trimmedName.length > 120) {
      toast.error("Informe um nome válido para o procedimento cirúrgico (máx. 120 caracteres).")
      return
    }
    if (!Number.isInteger(formData.durationMin) || formData.durationMin < 1 || formData.durationMin > 1440) {
      toast.error("A duração estimada deve ser entre 1 e 1440 minutos.")
      return
    }
    if (!Number.isFinite(formData.price) || formData.price < ASAAS_PIX_MINIMUM || formData.price > 50000) {
      toast.error(`O valor da cirurgia deve ser entre ${formatMoney(ASAAS_PIX_MINIMUM)} e R$ 50.000.`)
      return
    }

    const doctorId = formData.professionalId.trim() || null
    const selectedDoctor = doctorId ? allProfessionals.find((p) => p.id === doctorId) : null
    const needsImport = Boolean(selectedDoctor && !serverProfessionals.some((p) => p.id === selectedDoctor.id))

    setSaving(true)
    try {
      // If doctor selected is only in local demo store, import them to DB first
      if (needsImport && selectedDoctor) {
        const { name, specialty, credentialCode, bio, price, workDays, startHour, endHour, active } = selectedDoctor
        const importRes = await fetch("/api/desktop/professionals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedDoctor.id,
            form: { name, specialty, credentialCode, bio, price, workDays, startHour, endHour, active },
            services: selectedDoctor.services,
          }),
        })
        const importResult = (await importRes.json()) as { error?: string }
        if (!importRes.ok) throw new Error(importResult.error || "Não foi possível vincular o profissional ao banco.")
      }

      const newService: Service = {
        id: createId("cir"),
        name: trimmedName,
        durationMin: formData.durationMin,
        price: formData.price,
        kind: "cirurgia",
        modality: "presencial",
      }

      const response = await fetch("/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: doctorId,
          services: [newService],
        }),
      })

      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o procedimento cirúrgico.")

      toast.success("Cirurgia cadastrada com sucesso!")
      setDialogOpen(false)
      setFormData({
        name: "",
        durationMin: 60,
        price: 500,
        professionalId: "",
      })

      await refreshSurgeries()
      await refreshProfessionals()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar cirurgia.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-kicker">Procedimentos cirúrgicos</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Cirurgias</h1>
            {viewMode.isReadOnly && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                <ShieldAlert className="size-3.5" />
                {viewMode.badgeLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie procedimentos cirúrgicos, equipes médicas responsáveis e tabela de preços com desconto de associado.
          </p>
        </div>

        {canManage && (
          <Button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="self-start sm:self-auto"
          >
            <Plus className="mr-1.5 size-4" />
            Nova cirurgia
          </Button>
        )}
      </div>

      {/* Error alert */}
      {error ? (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshSurgeries()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="size-4 text-teal" />
            Total de cirurgias
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{metrics.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">Procedimentos cadastrados</p>
        </div>

        <div className="panel p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 text-teal" />
            Duração média
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{metrics.averageDurationMin} min</p>
          <p className="mt-1 text-xs text-muted-foreground">Tempo médio de procedimento</p>
        </div>

        <div className="panel p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Stethoscope className="size-4 text-teal" />
            Cirurgias com médico
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{metrics.withDoctorCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Vinculadas a cirurgião</p>
        </div>

        <div className="panel p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="size-4 text-teal" />
            Cirurgias da clínica
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{metrics.clinicCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Geral da clínica</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cirurgia ou médico responsável..."
            className="h-10 pl-9"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={responsibleFilter}
            onChange={(e) => setResponsibleFilter(e.target.value as "all" | "clinic" | "doctor")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
            aria-label="Filtrar por responsável"
          >
            <option value="all">Todos os procedimentos</option>
            <option value="doctor">Com médico responsável</option>
            <option value="clinic">Geral da clínica</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Carregando procedimentos cirúrgicos...
          </div>
        ) : filteredSurgeries.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={searchQuery || responsibleFilter !== "all" ? "Nenhuma cirurgia encontrada" : "Nenhuma cirurgia cadastrada"}
            description={
              searchQuery || responsibleFilter !== "all"
                ? "Tente ajustar os filtros ou a busca para encontrar procedimentos cirúrgicos."
                : "Cadastre procedimentos cirúrgicos para exibi-los no catálogo e agendamento da clínica."
            }
            action={
              canManage && !searchQuery && responsibleFilter === "all" ? (
                <Button type="button" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-1.5 size-4" />
                  Cadastrar primeira cirurgia
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Procedimento</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Tabela</TableHead>
                <TableHead className="text-right">Associado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSurgeries.map((surgery) => {
                const doctorName = surgery.professionalId ? professionalsMap.get(surgery.professionalId) : null
                const associatePrice = calculateAssociateSurgeryPrice(surgery.price, associateDiscountPercent)

                return (
                  <TableRow key={surgery.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="text-sm font-semibold">{surgery.name}</p>
                        <p className="text-xs text-muted-foreground">Cirurgia ambulatorial / eletiva</p>
                      </div>
                    </TableCell>

                    <TableCell>
                      {doctorName ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Stethoscope className="size-3.5 text-teal" />
                          <span>{doctorName}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Geral da clínica
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span>{surgery.durationMin} min</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right text-sm font-medium">
                      {formatMoney(surgery.price)}
                    </TableCell>

                    <TableCell className="text-right text-sm">
                      <div className="inline-flex flex-col items-end">
                        <span className="font-semibold text-teal">{formatMoney(associatePrice)}</span>
                        <span className="text-[11px] text-muted-foreground">-{associateDiscountPercent}% desc.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog Nova Cirurgia */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSurgery}>
            <DialogHeader>
              <DialogTitle>Nova cirurgia</DialogTitle>
              <DialogDescription>
                Cadastre um novo procedimento cirúrgico na clínica ou vincule a um médico responsável.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <label htmlFor="surgery-name" className="text-sm font-medium">
                  Nome do procedimento *
                </label>
                <Input
                  id="surgery-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex.: Colecistectomia Videolaparoscópica"
                  maxLength={120}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="surgery-duration" className="text-sm font-medium">
                    Duração estimada (min) *
                  </label>
                  <Input
                    id="surgery-duration"
                    type="number"
                    min={1}
                    max={1440}
                    value={formData.durationMin}
                    onChange={(e) => setFormData({ ...formData, durationMin: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="surgery-price" className="text-sm font-medium">
                    Preço de tabela (R$) *
                  </label>
                  <Input
                    id="surgery-price"
                    type="number"
                    step="0.01"
                    min={ASAAS_PIX_MINIMUM}
                    max={50000}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="surgery-doctor" className="text-sm font-medium">
                  Médico responsável
                </label>
                <select
                  id="surgery-doctor"
                  value={formData.professionalId}
                  onChange={(e) => setFormData({ ...formData, professionalId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                >
                  <option value="">Geral da Clínica (Sem médico específico)</option>
                  {allProfessionals
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Selecione um cirurgião ou deixe como &quot;Geral da Clínica&quot; para procedimento da instituição.
                </p>
              </div>

              {formData.price >= ASAAS_PIX_MINIMUM && (
                <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Preço para associado: </span>
                  <span className="font-semibold text-teal">
                    {formatMoney(calculateAssociateSurgeryPrice(formData.price, associateDiscountPercent))}
                  </span>{" "}
                  (com {associateDiscountPercent}% de desconto)
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar cirurgia"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
