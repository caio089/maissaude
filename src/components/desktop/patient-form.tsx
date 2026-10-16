"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import type { PatientInput, PatientStatus } from "@/lib/types"
import { validatePatientInput, type FieldErrors } from "@/lib/validation"

type PatientErrors = FieldErrors<keyof PatientInput>

interface ExistingPatient {
  id: string
  cpf: string
  phone: string
  email: string
}

export function emptyPatientForm(patients: ExistingPatient[]): PatientInput {
  const contact = nextDemoContact(patients)
  return {
    name: "",
    cpf: contact.cpf,
    phone: contact.phone,
    email: contact.email,
    birthDate: "1990-01-15",
    gender: "Feminino",
    address: "Rua da Demonstração, 200",
    city: "Teresina - PI",
    status: "active",
    notes: "Cadastro fictício criado durante a demonstração.",
  }
}

export function patientFormErrors(form: PatientInput, patients: ExistingPatient[], ignoreId?: string) {
  const errors = validatePatientInput(form)
  const others = patients.filter((patient) => patient.id !== ignoreId)
  if (others.some((patient) => patient.cpf.trim() === form.cpf.trim())) {
    errors.cpf = "Este CPF fictício já está cadastrado."
  }
  if (others.some((patient) => patient.phone.trim() === form.phone.trim())) {
    errors.phone = "Este telefone fictício já está cadastrado."
  }
  if (others.some((patient) => patient.email.trim().toLowerCase() === form.email.trim().toLowerCase())) {
    errors.email = "Este e-mail de demonstração já está cadastrado."
  }
  return errors
}

export function PatientFields({
  form,
  errors,
  onChange,
  idPrefix = "patient",
}: {
  form: PatientInput
  errors: PatientErrors
  onChange: (form: PatientInput) => void
  idPrefix?: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome" htmlFor={`${idPrefix}-name`} error={errors.name}>
        <Input id={`${idPrefix}-name`} className="h-10" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
      </Field>
      <Field label="CPF fictício" htmlFor={`${idPrefix}-cpf`} error={errors.cpf} hint="Comece com 900.">
        <Input id={`${idPrefix}-cpf`} className="h-10" value={form.cpf} onChange={(event) => onChange({ ...form, cpf: event.target.value })} />
      </Field>
      <Field label="Telefone fictício" htmlFor={`${idPrefix}-phone`} error={errors.phone}>
        <Input id={`${idPrefix}-phone`} className="h-10" value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
      </Field>
      <Field label="E-mail de demonstração" htmlFor={`${idPrefix}-email`} error={errors.email}>
        <Input id={`${idPrefix}-email`} className="h-10" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
      </Field>
      <Field label="Nascimento" htmlFor={`${idPrefix}-birth`} error={errors.birthDate}>
        <Input id={`${idPrefix}-birth`} type="date" className="h-10" value={form.birthDate} onChange={(event) => onChange({ ...form, birthDate: event.target.value })} />
      </Field>
      <Field label="Cidade" htmlFor={`${idPrefix}-city`} error={errors.city}>
        <Input id={`${idPrefix}-city`} className="h-10" value={form.city} onChange={(event) => onChange({ ...form, city: event.target.value })} />
      </Field>
      <Field label="Endereço" htmlFor={`${idPrefix}-address`}>
        <Input id={`${idPrefix}-address`} className="h-10" value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} />
      </Field>
      <Field label="Status">
        <Select value={form.status} onValueChange={(value) => onChange({ ...form, status: value as PatientStatus })}>
          <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Observação" htmlFor={`${idPrefix}-notes`}>
          <Textarea id={`${idPrefix}-notes`} value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
        </Field>
      </div>
    </div>
  )
}

export function PatientForm({
  open,
  title,
  form,
  errors,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean
  title: string
  form: PatientInput
  errors: PatientErrors
  onOpenChange: (open: boolean) => void
  onChange: (form: PatientInput) => void
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <PatientFields form={form} errors={errors} onChange={onChange} />
        <DialogFooter>
          <Button type="button" onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function nextDemoContact(patients: ExistingPatient[]) {
  const used = new Set(patients.flatMap((patient) => [patient.cpf, patient.phone, patient.email.toLowerCase()]))
  for (let sequence = 26; sequence < 900; sequence += 1) {
    const code = String(sequence).padStart(3, "0")
    const cpf = `900.100.${code}-10`
    const phone = `(86) 99000-${code}0`
    const email = `paciente.${code}@demonstracao.demo`
    if (!used.has(cpf) && !used.has(phone) && !used.has(email)) {
      return { cpf, phone, email }
    }
  }
  return {
    cpf: "900.900.000-10",
    phone: "(86) 99000-9000",
    email: "paciente.extra@demonstracao.demo",
  }
}
