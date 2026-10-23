"use client"

import { useState } from "react"
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
import { formatMoney, WEEKDAY_SHORT } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import { SPECIALTIES, SPECIALTY_LABEL, type Professional, type ProfessionalInput, type Specialty } from "@/lib/types"
import { hasErrors, validateProfessionalInput } from "@/lib/validation"

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
})

export function ProfessionalsView() {
  const router = useRouter()
  const professionals = useDemoStore((state) => state.data.professionals)
  const createProfessional = useDemoStore((state) => state.createProfessional)
  const updateProfessional = useDemoStore((state) => state.updateProfessional)
  const setAgendaProfessionalId = useDemoStore((state) => state.setAgendaProfessionalId)
  const setAgendaView = useDemoStore((state) => state.setAgendaView)
  const [selectedId, setSelectedId] = useState(professionals[0]?.id ?? "")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Professional | null>(null)
  const [form, setForm] = useState<ProfessionalInput>(blank())
  const [errors, setErrors] = useState<ReturnType<typeof validateProfessionalInput>>({})
  const selected = professionals.find((item) => item.id === selectedId) ?? professionals[0]

  function openCreate() {
    setEditing(null)
    setForm(blank())
    setErrors({})
    setOpen(true)
  }

  function openEdit(professional: Professional) {
    setEditing(professional)
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
    })
    setErrors({})
    setOpen(true)
  }

  function save() {
    const nextErrors = validateProfessionalInput(form)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    if (editing) {
      updateProfessional(editing.id, form)
      toast.success("Profissional atualizado.")
    } else {
      const id = createProfessional(form)
      setSelectedId(id)
      toast.success("Profissional adicionado.")
    }
    setOpen(false)
  }

  return (
    <FadeIn className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Clínica</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre os profissionais que atendem na sua unidade.</p>
        </div>
        <Button type="button" onClick={openCreate}><Plus /> Novo profissional</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="panel max-h-[72dvh] overflow-y-auto p-2">
          {professionals.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum profissional cadastrado.</p> : professionals.map((professional) => (
            <button key={professional.id} type="button" onClick={() => setSelectedId(professional.id)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${professional.id === selected?.id ? "bg-accent" : "hover:bg-muted"}`}>
              <Portrait seed={professional.avatarSeed} name={professional.name} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{professional.name}</span>
                <span className="block text-xs text-muted-foreground">{SPECIALTY_LABEL[professional.specialty]}</span>
              </span>
            </button>
          ))}
        </div>
        {selected ? (
          <article className="panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-4">
                <Portrait seed={selected.avatarSeed} name={selected.name} className="size-20" />
                <div>
                  <h2 className="text-2xl font-semibold">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">{SPECIALTY_LABEL[selected.specialty]}</p>
                  <p className="mt-2 text-sm">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">{selected.credentialLabel}</span>
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
              {selected.workDays.map((day) => (
                <span key={day} className="rounded-full bg-muted px-3 py-1 text-xs">{WEEKDAY_SHORT[day]}</span>
              ))}
              <span className="rounded-full bg-muted px-3 py-1 text-xs">{selected.startHour}–{selected.endHour}</span>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {selected.services.map((service) => (
                <div key={service.id} className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{service.durationMin} min · {service.modality === "teleconsulta" ? "teleconsulta" : "presencial"}</p>
                  <p className="mt-2 font-medium">{formatMoney(service.price)}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="flex items-center gap-2">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <p className="font-medium">{selected.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">Avaliações</span>
              </div>
              <ul className="mt-3 space-y-2">
                {selected.reviews.map((review) => (
                  <li key={review.id} className="rounded-2xl bg-muted/60 p-3 text-sm">
                    <p>{review.comment}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{review.author}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => openEdit(selected)}>Editar dados</Button>
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar profissional" : "Novo profissional"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="Nome" htmlFor="pro-name" error={errors.name}>
              <Input id="pro-name" className="h-10" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Especialidade">
              <Select value={form.specialty} onValueChange={(value) => setForm({ ...form, specialty: value as Specialty })}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((item) => <SelectItem key={item} value={item}>{SPECIALTY_LABEL[item]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Registro profissional" htmlFor="pro-credential" error={errors.credentialCode}>
              <Input id="pro-credential" className="h-10" value={form.credentialCode} onChange={(event) => setForm({ ...form, credentialCode: event.target.value })} />
            </Field>
            <Field label="Valor da consulta" htmlFor="pro-price" error={errors.price}>
              <Input id="pro-price" type="number" className="h-10" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} />
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
                          workDays: checked === true ? [...current.workDays, index].sort() : current.workDays.filter((day) => day !== index),
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
                <Input id="pro-start" type="time" className="h-10" value={form.startHour} onChange={(event) => setForm({ ...form, startHour: event.target.value })} />
              </Field>
              <Field label="Fim" htmlFor="pro-end">
                <Input id="pro-end" type="time" className="h-10" value={form.endHour} onChange={(event) => setForm({ ...form, endHour: event.target.value })} />
              </Field>
            </div>
            <Field label="Descrição" htmlFor="pro-bio" error={errors.bio}>
              <Textarea id="pro-bio" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  )
}
