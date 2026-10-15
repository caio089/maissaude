"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Users } from "lucide-react"
import { toast } from "sonner"
import { FadeIn } from "@/components/shared/fade-in"
import { Field } from "@/components/shared/field"
import { EmptyState } from "@/components/shared/empty-state"
import { Portrait } from "@/components/shared/portrait"
import { PaymentBadge, StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import type { Patient, PatientInput, PatientStatus } from "@/lib/types"
import { hasErrors, validatePatientInput } from "@/lib/validation"

const PAGE_SIZE = 8

const emptyForm = (): PatientInput => ({
  name: "",
  cpf: "900.100.099-10",
  phone: "(86) 99000-0000",
  email: "novo.paciente@demonstracao.demo",
  birthDate: "1990-01-15",
  gender: "Feminino",
  address: "Rua da Demonstração, 200",
  city: "Teresina - PI",
  status: "active",
  notes: "Cadastro fictício criado durante a demonstração.",
})

export function PatientsView() {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const search = useDemoStore((state) => state.patientSearch)
  const setSearch = useDemoStore((state) => state.setPatientSearch)
  const focusId = useDemoStore((state) => state.patientFocusId)
  const setFocusId = useDemoStore((state) => state.setPatientFocusId)
  const setRecordPatientId = useDemoStore((state) => state.setRecordPatientId)
  const createPatient = useDemoStore((state) => state.createPatient)
  const updatePatient = useDemoStore((state) => state.updatePatient)
  const [status, setStatus] = useState<PatientStatus | "all">("all")
  const [page, setPage] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [form, setForm] = useState<PatientInput>(emptyForm())
  const [errors, setErrors] = useState<Partial<Record<keyof PatientInput, string>>>({})

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.patients.filter((patient) => {
      if (status !== "all" && patient.status !== status) return false
      if (!query) return true
      return [patient.name, patient.cpf, patient.email, patient.phone].some((value) => value.toLowerCase().includes(query))
    })
  }, [data.patients, search, status])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const focused = data.patients.find((patient) => patient.id === focusId) ?? null

  useEffect(() => {
    setPage(0)
  }, [search, status])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(patient: Patient) {
    setEditing(patient)
    setForm({
      name: patient.name,
      cpf: patient.cpf,
      phone: patient.phone,
      email: patient.email,
      birthDate: patient.birthDate,
      gender: patient.gender,
      address: patient.address,
      city: patient.city,
      status: patient.status,
      notes: patient.notes,
    })
    setErrors({})
    setFormOpen(true)
  }

  function save() {
    const nextErrors = validatePatientInput(form)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    if (editing) {
      updatePatient(editing.id, form)
      toast.success("Cadastro fictício atualizado.")
    } else {
      const id = createPatient(form)
      setFocusId(id)
      toast.success("Paciente de demonstração cadastrado.")
    }
    setFormOpen(false)
  }

  return (
    <FadeIn className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.patients.length} cadastros fictícios. Nenhum dado real é armazenado.</p>
        </div>
        <Button type="button" onClick={openCreate}><Plus /> Novo paciente</Button>
      </div>

      <div className="panel flex flex-wrap gap-3 p-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, CPF, telefone ou e-mail" aria-label="Pesquisar pacientes" className="h-10 pl-9" />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as PatientStatus | "all")}>
          <SelectTrigger className="h-10 w-40" aria-label="Filtrar status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="panel overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum paciente encontrado" description="Ajuste a pesquisa ou cadastre um paciente fictício para continuar o roteiro." action={<Button type="button" onClick={openCreate}>Cadastrar</Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última consulta</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((patient) => {
                const last = data.appointments
                  .filter((item) => item.patientId === patient.id)
                  .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0]
                return (
                  <TableRow key={patient.id} className="cursor-pointer" onClick={() => setFocusId(patient.id)}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <Portrait seed={patient.name} name={patient.name} className="size-9" />
                        <span>
                          <span className="block font-medium">{patient.name}</span>
                          <span className="block text-xs text-muted-foreground">CPF demonstrativo {patient.cpf}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block">{patient.phone}</span>
                      <span className="block text-xs text-muted-foreground">{patient.email}</span>
                    </TableCell>
                    <TableCell>{patient.city}</TableCell>
                    <TableCell>{patient.status === "active" ? "Ativo" : "Inativo"}</TableCell>
                    <TableCell>{last ? formatDate(last.startsAt, "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); openEdit(patient) }}>Editar</Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">{filtered.length} resultados</span>
          <span className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
            <span>{page + 1} / {pages}</span>
            <Button type="button" variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((current) => current + 1)}>Próxima</Button>
          </span>
        </div>
      </div>

      <PatientForm open={formOpen} title={editing ? "Editar paciente" : "Novo paciente fictício"} form={form} errors={errors} onChange={setForm} onOpenChange={setFormOpen} onSave={save} />

      <Sheet open={Boolean(focused)} onOpenChange={(open) => !open && setFocusId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {focused ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <Portrait seed={focused.name} name={focused.name} />
                  {focused.name}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-8">
                <p className="text-sm text-muted-foreground">{focused.email} · {focused.phone}</p>
                <Tabs defaultValue="dados">
                  <TabsList>
                    <TabsTrigger value="dados">Cadastro</TabsTrigger>
                    <TabsTrigger value="consultas">Consultas</TabsTrigger>
                    <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                    <TabsTrigger value="prontuario">Prontuário</TabsTrigger>
                  </TabsList>
                  <TabsContent value="dados" className="space-y-2 text-sm">
                    <p>CPF demonstrativo: {focused.cpf}</p>
                    <p>Nascimento fictício: {formatDate(focused.birthDate, "dd/MM/yyyy")}</p>
                    <p>{focused.address}, {focused.city}</p>
                    <p className="text-muted-foreground">{focused.notes}</p>
                    <Button type="button" variant="outline" onClick={() => openEdit(focused)}>Editar cadastro</Button>
                  </TabsContent>
                  <TabsContent value="consultas" className="space-y-3">
                    {data.appointments.filter((item) => item.patientId === focused.id).map((item) => {
                      const professional = data.professionals.find((person) => person.id === item.professionalId)
                      return (
                        <div key={item.id} className="rounded-2xl bg-muted/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{formatDate(item.startsAt, "dd/MM/yyyy HH:mm")}</p>
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{professional?.name}</p>
                        </div>
                      )
                    })}
                  </TabsContent>
                  <TabsContent value="financeiro" className="space-y-3">
                    {data.payments.filter((item) => item.patientId === focused.id).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/70 p-3">
                        <div>
                          <p className="text-sm font-medium">{formatMoney(item.amount)}</p>
                          <p className="text-xs text-muted-foreground">{item.reference}</p>
                        </div>
                        <PaymentBadge status={item.status} />
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="prontuario">
                    <p className="mb-3 text-sm text-muted-foreground">Os prontuários desta demonstração são editáveis e não contêm diagnóstico real.</p>
                    <Button type="button" onClick={() => { setRecordPatientId(focused.id); router.push("/desktop/prontuarios") }}>Abrir prontuário</Button>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </FadeIn>
  )
}

function PatientForm({
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
  errors: Partial<Record<keyof PatientInput, string>>
  onOpenChange: (open: boolean) => void
  onChange: (form: PatientInput) => void
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" htmlFor="patient-name" error={errors.name}>
            <Input id="patient-name" className="h-10" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
          </Field>
          <Field label="CPF fictício" htmlFor="patient-cpf" error={errors.cpf} hint="Comece com 900.">
            <Input id="patient-cpf" className="h-10" value={form.cpf} onChange={(event) => onChange({ ...form, cpf: event.target.value })} />
          </Field>
          <Field label="Telefone fictício" htmlFor="patient-phone" error={errors.phone}>
            <Input id="patient-phone" className="h-10" value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="E-mail de demonstração" htmlFor="patient-email" error={errors.email}>
            <Input id="patient-email" className="h-10" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Nascimento" htmlFor="patient-birth" error={errors.birthDate}>
            <Input id="patient-birth" type="date" className="h-10" value={form.birthDate} onChange={(event) => onChange({ ...form, birthDate: event.target.value })} />
          </Field>
          <Field label="Cidade" htmlFor="patient-city" error={errors.city}>
            <Input id="patient-city" className="h-10" value={form.city} onChange={(event) => onChange({ ...form, city: event.target.value })} />
          </Field>
          <Field label="Endereço" htmlFor="patient-address">
            <Input id="patient-address" className="h-10" value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} />
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
            <Field label="Observação" htmlFor="patient-notes">
              <Textarea id="patient-notes" value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
