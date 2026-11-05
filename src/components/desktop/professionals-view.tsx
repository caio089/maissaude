"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Star } from "lucide-react"
import { toast } from "sonner"
import { FadeIn } from "@/components/shared/fade-in"
import { Field } from "@/components/shared/field"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ServiceFields } from "@/components/desktop/service-fields"
import { formatMoney, WEEKDAY_SHORT } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import {
  SPECIALTIES,
  SPECIALTY_LABEL,
  type ClinicRole,
  type Professional,
  type ProfessionalInput,
  type Service,
  type Specialty,
} from "@/lib/types"
import { hasErrors, MIN_PROFESSIONAL_PRICE, validateProfessionalInput } from "@/lib/validation"

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024

const blank = (): ProfessionalInput => ({
  name: "",
  specialty: "clinica-geral",
  credentialCode: "",
  bio: "",
  price: 0,
  workDays: [1, 2, 3, 4, 5],
  startHour: "08:00",
  endHour: "18:00",
  active: true,
  photoUrl: null,
})

export function canManageProfessionals(role?: ClinicRole | null): boolean {
  return role !== "attendant"
}

export function getProfessionalsViewMode(role?: ClinicRole | null): {
  isReadOnly: boolean
  badgeLabel: string | null
} {
  if (role === "attendant") {
    return {
      isReadOnly: true,
      badgeLabel: "Modo somente leitura",
    }
  }
  return {
    isReadOnly: false,
    badgeLabel: null,
  }
}

export interface ProfessionalsViewProps {
  initialRole?: ClinicRole
  initialProfessionals?: Professional[]
}

export function ProfessionalsView({
  initialRole,
  initialProfessionals,
}: ProfessionalsViewProps = {}) {
  const router = useRouter()
  const [role, setRole] = useState<ClinicRole | null>(initialRole ?? null)
  const localProfessionals = useDemoStore((state) => state.data.professionals)
  const [serverProfessionals, setServerProfessionals] = useState<Professional[]>(initialProfessionals ?? [])
  const [loadError, setLoadError] = useState("")
  const [saving, setSaving] = useState(false)
  const professionals = useMemo(() => {
    const items = new Map(localProfessionals.map((professional) => [professional.id, professional]))
    for (const professional of serverProfessionals) items.set(professional.id, professional)
    return [...items.values()]
  }, [localProfessionals, serverProfessionals])
  const setAgendaProfessionalId = useDemoStore((state) => state.setAgendaProfessionalId)
  const setAgendaView = useDemoStore((state) => state.setAgendaView)
  const [selectedId, setSelectedId] = useState(professionals[0]?.id ?? "")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Professional | null>(null)
  const [draftId, setDraftId] = useState("")
  const [form, setForm] = useState<ProfessionalInput>(blank())
  const [services, setServices] = useState<Service[]>([])
  const [errors, setErrors] = useState<ReturnType<typeof validateProfessionalInput>>({})
  const selected = professionals.find((item) => item.id === selectedId) ?? professionals[0]

  const canManage = canManageProfessionals(role)
  const viewMode = getProfessionalsViewMode(role)

  const availableSpecialties = useMemo(() => {
    const set = new Set<string>(SPECIALTIES)
    if (form.specialty) set.add(form.specialty)
    return Array.from(set)
  }, [form.specialty])

  function handlePhotoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("A foto deve ter no máximo 1.5 MB.")
      event.target.value = ""
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((prev) => ({ ...prev, photoUrl: reader.result as string }))
      }
    }
    reader.readAsDataURL(file)
  }

  async function refresh() {
    const response = await fetch("/api/desktop/professionals", { cache: "no-store" })
    const result = (await response.json()) as { professionals?: Professional[]; error?: string }
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os profissionais.")
    setServerProfessionals(result.professionals || [])
    setLoadError("")
  }

  useEffect(() => {
    let active = true

    fetch("/api/desktop/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((sessionData) => {
        if (active && sessionData?.authenticated) {
          setRole(sessionData.role)
        }
      })
      .catch(() => {})

    const controller = new AbortController()
    fetch("/api/desktop/professionals", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as { professionals?: Professional[]; error?: string }
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar os profissionais.")
        if (!controller.signal.aborted) setServerProfessionals(result.professionals || [])
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os profissionais.")
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  function openCreate() {
    if (!canManage) return
    setEditing(null)
    setDraftId(`pro-${crypto.randomUUID()}`)
    setForm(blank())
    setServices([])
    setErrors({})
    setOpen(true)
  }

  function openEdit(professional: Professional) {
    if (!canManage) return
    setEditing(professional)
    setDraftId(professional.id)
    setForm({
      name: professional.name,
      specialty: professional.specialty,
      credentialCode: professional.credentialCode,
      bio: professional.bio,
      price: professional.price,
      workDays: professional.workDays,
      startHour: professional.startHour,
      endHour: professional.endHour,
      active: professional.active,
      photoUrl: professional.photoUrl || null,
    })
    setServices(professional.services.map((service) => ({ ...service, kind: service.kind || "consulta" })))
    setErrors({})
    setOpen(true)
  }

  async function save() {
    if (!canManage) {
      toast.error("Ação restrita à administração da clínica.")
      return
    }
    const nextErrors = validateProfessionalInput(form)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    if (
      services.some(
        (service) =>
          !service.name.trim() ||
          service.price < MIN_PROFESSIONAL_PRICE ||
          !Number.isInteger(service.durationMin) ||
          service.durationMin <= 0,
      )
    ) {
      toast.error("Cada atendimento precisa custar pelo menos R$ 10 para gerar Pix.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/desktop/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, form, services }),
      })
      const result = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !result.id) throw new Error(result.error || "Não foi possível salvar o profissional.")
      setSelectedId(result.id)
      setOpen(false)
      try {
        await refresh()
      } catch {
        toast.warning("Profissional salvo. Atualize a página para conferir os dados.")
      }
      toast.success("Profissional e atendimentos salvos no banco.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o profissional.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <FadeIn className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="section-kicker">Clínica</p>
            {viewMode.isReadOnly && (
              <span
                data-testid="badge-readonly"
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border"
              >
                {viewMode.badgeLabel}
              </span>
            )}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {viewMode.isReadOnly
              ? "Consulte os profissionais cadastrados e seus horários de atendimento."
              : "Cadastre os profissionais que atendem na sua unidade."}
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={openCreate} data-testid="btn-new-professional">
            <Plus /> Novo profissional
          </Button>
        )}
      </div>
      {loadError ? <p role="alert" className="text-sm text-destructive">{loadError}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="panel max-h-[72dvh] overflow-y-auto p-2">
          {professionals.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum profissional cadastrado.</p>
          ) : (
            professionals.map((professional) => (
              <button
                key={professional.id}
                type="button"
                onClick={() => setSelectedId(professional.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${professional.id === selected?.id ? "bg-accent" : "hover:bg-muted"}`}
              >
                <Portrait seed={professional.avatarSeed} name={professional.name} photoUrl={professional.photoUrl} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{professional.name}</span>
                  <span className="block text-xs text-muted-foreground">{SPECIALTY_LABEL[professional.specialty] || professional.specialty}</span>
                </span>
              </button>
            ))
          )}
        </div>
        {selected ? (
          <article className="panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-4">
                <Portrait seed={selected.avatarSeed} name={selected.name} photoUrl={selected.photoUrl} className="size-20" />
                <div>
                  <h2 className="text-2xl font-semibold">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">{SPECIALTY_LABEL[selected.specialty] || selected.specialty}</p>
                  <p className="mt-2 text-sm">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                      {selected.credentialLabel}
                    </span>
                    <span className="ml-2 font-medium">{selected.credentialCode}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold">{formatMoney(selected.price)}</p>
                <p className="text-xs text-muted-foreground">valor da consulta</p>
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">{selected.bio}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(selected.workDays ?? []).map((day) => (
                <span key={day} className="rounded-full bg-muted px-3 py-1 text-xs">
                  {WEEKDAY_SHORT[day]}
                </span>
              ))}
              <span className="rounded-full bg-muted px-3 py-1 text-xs">
                {selected.startHour}–{selected.endHour}
              </span>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {(selected.services ?? []).map((service) => (
                <div key={service.id} className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {service.kind === "cirurgia"
                      ? "Cirurgia"
                      : service.kind === "exame"
                        ? "Procedimento ou exame"
                        : "Consulta"}{" "}
                    · {service.durationMin} min ·{" "}
                    {service.modality === "teleconsulta" ? "teleconsulta" : "presencial"}
                  </p>
                  <p className="mt-2 font-medium">{formatMoney(service.price)}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="flex items-center gap-2">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <p className="font-medium">
                  {(selected.rating ?? 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </p>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">Avaliações</span>
              </div>
              <ul className="mt-3 space-y-2">
                {(selected.reviews ?? []).map((review) => (
                  <li key={review.id} className="rounded-2xl bg-muted/60 p-3 text-sm">
                    <p>{review.comment}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{review.author}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {canManage && (
                <Button type="button" variant="outline" onClick={() => openEdit(selected)}>
                  Editar dados
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  setAgendaProfessionalId(selected.id)
                  setAgendaView("day")
                  router.push("/desktop/agenda")
                }}
              >
                Abrir agenda individual
              </Button>
            </div>
          </article>
        ) : null}
      </div>
      <Dialog
        open={open && canManage}
        onOpenChange={(val) => {
          if (!canManage) {
            setOpen(false)
            return
          }
          setOpen(val)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar profissional" : "Novo profissional"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Foto do profissional" hint="Envie uma foto (máx. 1.5 MB) ou informe a URL direta.">
              <div className="flex items-center gap-4">
                <Portrait
                  seed={form.name.trim() || "profissional"}
                  photoUrl={form.photoUrl}
                  name={form.name || "Profissional"}
                  className="size-16 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-xs hover:bg-muted">
                      <span>Escolher foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handlePhotoFileChange}
                      />
                    </label>
                    {form.photoUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => setForm((prev) => ({ ...prev, photoUrl: null }))}
                      >
                        Remover foto
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    placeholder="https://exemplo.com/foto.jpg"
                    className="h-8 text-xs"
                    value={form.photoUrl?.startsWith("data:") ? "" : (form.photoUrl ?? "")}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        photoUrl: event.target.value.trim() || null,
                      }))
                    }
                  />
                </div>
              </div>
            </Field>
            <Field label="Nome" htmlFor="pro-name" error={errors.name}>
              <Input
                id="pro-name"
                className="h-10"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Especialidade">
              <Select
                value={form.specialty}
                onValueChange={(value) => setForm({ ...form, specialty: value as Specialty })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableSpecialties.map((item) => (
                    <SelectItem key={item} value={item}>
                      {SPECIALTY_LABEL[item] || item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Registro profissional" htmlFor="pro-credential" error={errors.credentialCode}>
              <Input
                id="pro-credential"
                className="h-10"
                value={form.credentialCode}
                onChange={(event) => setForm({ ...form, credentialCode: event.target.value })}
              />
            </Field>
            <Field
              label="Valor da consulta"
              htmlFor="pro-price"
              error={errors.price}
              hint="Para testar Pix na Asaas, use a partir de R$ 10."
            >
              <Input
                id="pro-price"
                type="number"
                min={MIN_PROFESSIONAL_PRICE}
                max="2000"
                step="0.01"
                className="h-10"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
              />
            </Field>
            <Field label="Dias de atendimento" error={errors.workDays}>
              <div className="flex flex-wrap gap-3">
                {WEEKDAY_SHORT.map((label, index) => (
                  <label key={label} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.workDays.includes(index)}
                      onCheckedChange={(checked) => {
                        setForm((current) => ({
                          ...current,
                          workDays:
                            checked === true
                              ? [...current.workDays, index].sort()
                              : current.workDays.filter((day) => day !== index),
                        }))
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início" htmlFor="pro-start">
                <Input
                  id="pro-start"
                  type="time"
                  className="h-10"
                  value={form.startHour}
                  onChange={(event) => setForm({ ...form, startHour: event.target.value })}
                />
              </Field>
              <Field label="Fim" htmlFor="pro-end">
                <Input
                  id="pro-end"
                  type="time"
                  className="h-10"
                  value={form.endHour}
                  onChange={(event) => setForm({ ...form, endHour: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Descrição" htmlFor="pro-bio" error={errors.bio}>
              <Textarea id="pro-bio" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
            </Field>
            <ServiceFields services={services} onChange={setServices} savedIds={editing?.services.map((service) => service.id)} />
          </div>
          <DialogFooter>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  )
}
