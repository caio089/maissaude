"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Copy, CreditCard, ExternalLink, IdCard, Plus, QrCode, Receipt, Search } from "lucide-react"
import { toast } from "sonner"
import { AssociateRulesCard } from "@/components/desktop/associate-rules-card"
import { Field } from "@/components/shared/field"
import { EmptyState } from "@/components/shared/empty-state"
import { FadeIn } from "@/components/shared/fade-in"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney } from "@/lib/format"
import { cpfDigits, formatCpf } from "@/lib/cpf"
import { useDemoStore } from "@/lib/store"
import type { Associate, AssociateInput, AssociateStatus, Patient } from "@/lib/types"
import { hasErrors, validateAssociateInput, type FieldErrors } from "@/lib/validation"

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD"
type StatusFilter = "all" | "active" | "overdue" | "cancelled"

type PaymentResult = {
  billingType: BillingType
  value: number
  paymentUrl?: string
  pix?: { payload: string; encodedImage: string } | null
  bankSlipUrl?: string | null
  bankSlipBarcode?: string | null
  identificationField?: string | null
}

export function AssociatesView() {
  const associates = useDemoStore((state) => state.associates)
  const localPatients = useDemoStore((state) => state.data.patients)
  const rules = useDemoStore((state) => state.associateRules)
  const createAssociate = useDemoStore((state) => state.createAssociate)
  const updateAssociate = useDemoStore((state) => state.updateAssociate)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Associate | null>(null)
  const [form, setForm] = useState<AssociateInput>(() => emptyAssociateForm())
  const [errors, setErrors] = useState<FieldErrors<keyof AssociateInput>>({})
  const [newAssociateBillingType, setNewAssociateBillingType] = useState<BillingType>("PIX")
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState<"new" | "patient">("new")
  const [patientQuery, setPatientQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<PatientChoice | null>(null)
  const [serverPatients, setServerPatients] = useState<PatientChoice[]>([])
  const [serverAssociates, setServerAssociates] = useState<Associate[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)

  // Estados para modal de cobrança / pagamento multi-opções
  const [paymentModalAssociate, setPaymentModalAssociate] = useState<Associate | null>(null)
  const [selectedBillingType, setSelectedBillingType] = useState<BillingType>("PIX")
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [generatingPayment, setGeneratingPayment] = useState(false)
  const [registeringCounter, setRegisteringCounter] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/api/payments/associate", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as {
          patients?: PatientChoice[]
          associates?: (Associate & {
            created_at?: string
            overdue_months?: number
            next_due_date?: string | null
            last_paid_at?: string | null
          })[]
        }
        if (active) {
          if (Array.isArray(body.associates)) {
            setServerAssociates(
              body.associates.map((item) => ({
                ...item,
                overdueMonths: item.overdueMonths ?? item.overdue_months ?? 0,
                nextDueDate: item.nextDueDate ?? item.next_due_date ?? null,
                lastPaidAt: item.lastPaidAt ?? item.last_paid_at ?? null,
                createdAt: item.createdAt || item.created_at || new Date().toISOString(),
              })),
            )
          }
          if (Array.isArray(body.patients)) setServerPatients(body.patients)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const allAssociates = useMemo(() => {
    const map = new Map<string, Associate>()
    for (const item of associates) map.set(cpfDigits(item.cpf), item)
    for (const item of serverAssociates) map.set(cpfDigits(item.cpf), item)
    return [...map.values()]
  }, [associates, serverAssociates])

  const patientChoices = useMemo(() => {
    const all = new Map<string, PatientChoice>()
    for (const patient of localPatients.filter((item) => item.status === "active")) {
      all.set(cpfDigits(patient.cpf), { ...patient, snapshot: patient })
    }
    for (const patient of serverPatients) all.set(cpfDigits(patient.cpf), patient)
    const term = patientQuery.trim().toLowerCase()
    return [...all.values()]
      .filter((patient) => !term || [patient.name, patient.cpf, patient.phone, patient.email].some((value) => value.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [localPatients, serverPatients, patientQuery])

  const counts = useMemo(() => {
    let active = 0
    let overdue = 0
    let cancelled = 0
    for (const item of allAssociates) {
      if (item.status === "active") active++
      else if (item.status === "overdue") overdue++
      else if (item.status === "cancelled") cancelled++
    }
    return {
      all: allAssociates.length,
      active,
      overdue,
      cancelled,
    }
  }, [allAssociates])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return allAssociates.filter((associate) => {
      if (statusFilter !== "all" && associate.status !== statusFilter) {
        return false
      }
      if (!term) return true
      return [associate.name, associate.cpf, associate.phone, associate.email].some((value) =>
        value.toLowerCase().includes(term),
      )
    })
  }, [allAssociates, query, statusFilter])

  function openCreate() {
    setEditing(null)
    setForm(emptyAssociateForm())
    setErrors({})
    setSource("new")
    setSelectedPatient(null)
    setPatientQuery("")
    setNewAssociateBillingType("PIX")
    setFormOpen(true)
  }

  async function choosePatientSource() {
    setSource("patient")
    setSelectedPatient(null)
    setForm(emptyAssociateForm())
    setErrors({})
    setLoadingPatients(true)
    try {
      const response = await fetch("/api/payments/associate", { cache: "no-store" })
      if (!response.ok) throw new Error()
      const body = (await response.json()) as { patients: PatientChoice[] }
      setServerPatients(body.patients)
    } catch {
      setServerPatients([])
      toast.error("Não foi possível buscar pacientes do banco. Os pacientes deste navegador continuam disponíveis.")
    } finally {
      setLoadingPatients(false)
    }
  }

  function selectPatient(patient: PatientChoice) {
    setSelectedPatient(patient)
    setForm({
      name: patient.name,
      cpf: formatCpf(patient.cpf),
      phone: patient.phone,
      email: patient.email,
      status: "inactive",
      overdueMonths: 0,
    })
    setErrors({})
  }

  function openEdit(associate: Associate) {
    setEditing(associate)
    setForm({
      name: associate.name,
      cpf: associate.cpf,
      phone: associate.phone,
      email: associate.email,
      status: associate.status,
      overdueMonths: associate.overdueMonths ?? 0,
      nextDueDate: associate.nextDueDate ?? null,
    })
    setErrors({})
    setFormOpen(true)
  }

  function openPaymentDialog(associate: Associate) {
    setPaymentModalAssociate(associate)
    setSelectedBillingType("PIX")
    setPaymentResult(null)
  }

  async function generatePaymentForAssociate(target: Associate, method: BillingType) {
    setGeneratingPayment(true)
    try {
      const response = await fetch("/api/payments/associate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: target.name,
          cpf: target.cpf,
          phone: target.phone,
          email: target.email,
          billingType: method,
          monthsToPay: target.overdueMonths && target.overdueMonths > 0 ? target.overdueMonths : 1,
        }),
      })
      const body = (await response.json()) as {
        error?: string
        associateId?: string
        value?: number
        billingType?: BillingType
        paymentUrl?: string
        pix?: { payload: string; encodedImage: string } | null
        bankSlipUrl?: string | null
        bankSlipBarcode?: string | null
        identificationField?: string | null
      }
      if (!response.ok || !body.value) {
        toast.error(body.error || "Não foi possível gerar a cobrança.")
        return
      }
      setPaymentResult({
        billingType: method,
        value: body.value,
        paymentUrl: body.paymentUrl,
        pix: body.pix,
        bankSlipUrl: body.bankSlipUrl,
        bankSlipBarcode: body.bankSlipBarcode || body.identificationField,
        identificationField: body.identificationField,
      })
      toast.success("Cobrança gerada com sucesso!")
    } catch {
      toast.error("Erro ao conectar com o serviço de pagamentos.")
    } finally {
      setGeneratingPayment(false)
    }
  }

  async function handleCounterPayment(target: Associate) {
    setRegisteringCounter(true)
    try {
      const response = await fetch("/api/payments/associate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: target.id,
          status: "active",
          overdueMonths: 0,
        }),
      })
      const body = (await response.json()) as { error?: string; ok?: boolean; associate?: Associate }
      if (!response.ok || !body.ok) {
        toast.error(body.error || "Não foi possível registrar o recebimento no balcão.")
        return
      }
      setServerAssociates((prev) =>
        prev.map((item) =>
          item.id === target.id
            ? { ...item, status: "active", overdueMonths: 0, lastPaidAt: new Date().toISOString() }
            : item,
        ),
      )
      updateAssociate(target.id, {
        name: target.name,
        cpf: target.cpf,
        phone: target.phone,
        email: target.email,
        status: "active",
        overdueMonths: 0,
      })
      toast.success("Recebimento no balcão registrado! Associado ativo e regularizado.")
      setPaymentModalAssociate(null)
      setPaymentResult(null)
    } catch {
      toast.error("Erro ao registrar recebimento.")
    } finally {
      setRegisteringCounter(false)
    }
  }

  async function save() {
    if (!editing && source === "patient" && !selectedPatient) {
      toast.error("Selecione um paciente ativo.")
      return
    }
    const normalizedForm = {
      ...form,
      cpf: cpfDigits(form.cpf),
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
    }
    const nextErrors = validateAssociateInput(normalizedForm)
    const others = associates.filter((associate) => associate.id !== editing?.id)
    if (others.some((associate) => cpfDigits(associate.cpf) === normalizedForm.cpf)) {
      nextErrors.cpf = "Este CPF já está cadastrado como associado."
    }
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return

    if (!editing) {
      setSaving(true)
      try {
        const response = await fetch("/api/payments/associate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...normalizedForm,
            billingType: newAssociateBillingType,
            patientId: selectedPatient?.id,
            patient: selectedPatient?.snapshot,
          }),
        })
        const body = (await response.json()) as {
          error?: string
          associateId?: string
          value?: number
          billingType?: BillingType
          paymentUrl?: string
          pix?: { payload: string; encodedImage: string } | null
          bankSlipUrl?: string | null
          bankSlipBarcode?: string | null
          identificationField?: string | null
        }
        if (!response.ok || !body.value || !body.associateId) {
          toast.error(body.error || "Não foi possível gerar a cobrança.")
          return
        }
        const newAss: Associate = {
          id: body.associateId,
          name: normalizedForm.name,
          cpf: normalizedForm.cpf,
          phone: normalizedForm.phone,
          email: normalizedForm.email,
          status: "inactive",
          overdueMonths: 0,
          createdAt: new Date().toISOString(),
        }
        const result = createAssociate({ ...normalizedForm, status: "inactive", overdueMonths: 0 }, body.associateId)
        if (!result.ok) {
          toast.warning("Cobrança criada, mas a lista local não foi atualizada.")
        }
        setServerAssociates((prev) => [newAss, ...prev])
        setFormOpen(false)

        // Abre o diálogo de pagamento imediatamente com a cobrança gerada
        setPaymentModalAssociate(newAss)
        setSelectedBillingType(newAssociateBillingType)
        setPaymentResult({
          billingType: newAssociateBillingType,
          value: body.value,
          paymentUrl: body.paymentUrl,
          pix: body.pix,
          bankSlipUrl: body.bankSlipUrl,
          bankSlipBarcode: body.bankSlipBarcode || body.identificationField,
          identificationField: body.identificationField,
        })
        toast.success("Associado cadastrado e cobrança gerada com sucesso!")
        return
      } catch {
        toast.error("Não foi possível confirmar a criação da cobrança. Confira antes de tentar novamente.")
        return
      } finally {
        setSaving(false)
      }
    }

    setSaving(true)
    try {
      await fetch("/api/payments/associate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          ...normalizedForm,
          overdueMonths: normalizedForm.status === "active" ? 0 : editing.overdueMonths,
        }),
      })
      setServerAssociates((prev) =>
        prev.map((item) =>
          item.id === editing.id
            ? {
                ...item,
                ...normalizedForm,
                overdueMonths: normalizedForm.status === "active" ? 0 : item.overdueMonths,
              }
            : item,
        ),
      )
    } catch {
      // continua para atualizar localmente
    } finally {
      setSaving(false)
    }

    const result = updateAssociate(editing.id, {
      ...normalizedForm,
      overdueMonths: normalizedForm.status === "active" ? 0 : editing.overdueMonths,
    })
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success("Associado atualizado.")
    setFormOpen(false)
  }

  return (
    <FadeIn className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Assinaturas</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Associados</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Gerencie associados, emita cobranças via Pix, Boleto ou Cartão e registre recebimentos presenciais no balcão.
          </p>
        </div>
        <Button type="button" onClick={openCreate}><Plus /> Novo associado</Button>
      </div>

      <AssociateRulesCard />

      <div className="panel p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, CPF, telefone ou e-mail"
              aria-label="Pesquisar associados"
              className="h-10 pl-9"
            />
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-1"
            role="tablist"
            aria-label="Filtrar associados por status"
          >
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              Todos
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  statusFilter === "all" ? "bg-muted text-foreground" : "bg-muted/80 text-muted-foreground"
                }`}
              >
                {counts.all}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === "active"
                  ? "bg-background text-emerald-700 shadow-xs font-semibold dark:text-emerald-400"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              Em dia
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  statusFilter === "active"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {counts.active}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "overdue"}
              onClick={() => setStatusFilter("overdue")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === "overdue"
                  ? "bg-background text-amber-700 shadow-xs font-semibold dark:text-amber-400"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              Em atraso
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  statusFilter === "overdue"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {counts.overdue}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "cancelled"}
              onClick={() => setStatusFilter("cancelled")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === "cancelled"
                  ? "bg-background text-rose-700 shadow-xs font-semibold dark:text-rose-400"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              Cancelados
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  statusFilter === "cancelled"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {counts.cancelled}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={IdCard}
            title={statusFilter !== "all" || query ? "Nenhum associado encontrado" : "Nenhum associado cadastrado"}
            description={
              statusFilter !== "all" || query
                ? "Tente ajustar o filtro de status ou os termos da pesquisa."
                : "Cadastre os associados e acompanhe os benefícios vinculados ao plano."
            }
            action={
              statusFilter !== "all" || query ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("all")
                    setQuery("")
                  }}
                >
                  Limpar filtros
                </Button>
              ) : (
                <Button type="button" onClick={openCreate}>
                  Cadastrar
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Associado</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Mensalidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((associate) => (
                <TableRow key={associate.id}>
                  <TableCell>
                    <span className="block font-medium">{associate.name}</span>
                    <span className="block text-xs text-muted-foreground">CPF {formatCpf(associate.cpf)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block">{associate.phone}</span>
                    <span className="block text-xs text-muted-foreground">{associate.email}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block font-medium">{formatMoney(rules.fee)}</span>
                    {associate.status === "overdue" && (associate.overdueMonths || 0) > 0 ? (
                      <span className="block text-xs font-semibold text-amber-700">
                        Pendente: {formatMoney(rules.fee * (associate.overdueMonths || 1))}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {associate.status === "active" && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Em dia
                      </span>
                    )}
                    {associate.status === "overdue" && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        {(associate.overdueMonths || 1) === 1 ? "1 mês atraso" : `${associate.overdueMonths} meses atraso`}
                      </span>
                    )}
                    {associate.status === "cancelled" && (
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                        Cancelado
                      </span>
                    )}
                    {(associate.status === "inactive" || !["active", "overdue", "cancelled"].includes(associate.status)) && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        Aguardando
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(associate.createdAt || (associate as any).created_at, "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openPaymentDialog(associate)}
                        className="h-8 gap-1.5"
                      >
                        <CreditCard className="size-3.5" />
                        Pagamento
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(associate)}
                        className="h-8"
                      >
                        Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal de Criação / Edição de Associado */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!saving) setFormOpen(open) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar associado" : "Novo associado"}</DialogTitle>
          </DialogHeader>
          {!editing ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button type="button" variant={source === "new" ? "default" : "outline"} onClick={() => { setSource("new"); setSelectedPatient(null); setForm(emptyAssociateForm()); setErrors({}) }}>Novo cadastro</Button>
                <Button type="button" variant={source === "patient" ? "default" : "outline"} onClick={() => void choosePatientSource()}>Buscar paciente ativo</Button>
              </div>
              {source === "patient" ? (
                <div className="space-y-2">
                  <Input aria-label="Buscar paciente ativo" placeholder="Nome, CPF, telefone ou e-mail" value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} />
                  {selectedPatient ? <p className="text-sm">Paciente selecionado: <strong>{selectedPatient.name}</strong></p> : null}
                  <div className="max-h-36 overflow-y-auto rounded-md border">
                    {loadingPatients ? <p className="p-3 text-sm text-muted-foreground">Buscando pacientes...</p> : patientChoices.length ? patientChoices.map((patient) => (
                      <button key={patient.id} type="button" className="block w-full border-b p-2 text-left text-sm last:border-0 hover:bg-accent" onClick={() => selectPatient(patient)}>
                        <span className="block font-medium">{patient.name}</span><span className="text-muted-foreground">CPF {formatCpf(patient.cpf)} · {patient.phone}</span>
                      </button>
                    )) : <p className="p-3 text-sm text-muted-foreground">Nenhum paciente ativo encontrado.</p>}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" htmlFor="associate-name" error={errors.name}>
              <Input id="associate-name" className="h-10" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="CPF" htmlFor="associate-cpf" error={errors.cpf}>
              <Input id="associate-cpf" className="h-10" inputMode="numeric" placeholder="Somente números" value={form.cpf} disabled={!editing && source === "patient" && Boolean(selectedPatient)} onChange={(event) => setForm({ ...form, cpf: formatCpf(event.target.value) })} />
            </Field>
            <Field label="Telefone" htmlFor="associate-phone" error={errors.phone}>
              <Input id="associate-phone" className="h-10" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="E-mail" htmlFor="associate-email" error={errors.email}>
              <Input id="associate-email" className="h-10" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            {editing ? (
              <Field label="Status">
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as AssociateStatus })}>
                  <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo (Em dia)</SelectItem>
                    <SelectItem value="overdue">Em atraso</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="inactive">Inativo (Aguardando)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field label="Forma de pagamento inicial">
                <Select value={newAssociateBillingType} onValueChange={(value) => setNewAssociateBillingType(value as BillingType)}>
                  <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">Pix (QR Code imediato)</SelectItem>
                    <SelectItem value="BOLETO">Boleto bancário</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <p className="self-end text-sm text-muted-foreground sm:col-span-2">
              Mensalidade de {formatMoney(rules.fee)}. A associação é ativada automaticamente com a confirmação ou recebimento presencial.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={saving || (!editing && source === "patient" && !selectedPatient)}
              onClick={() => void save()}
            >
              {saving ? "Processando..." : editing ? "Salvar alterações" : "Cadastrar e gerar cobrança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Completo de Pagamento / Cobrança e Balcão */}
      <Dialog
        open={Boolean(paymentModalAssociate)}
        onOpenChange={(open) => {
          if (!open && !registeringCounter && !generatingPayment) {
            setPaymentModalAssociate(null)
            setPaymentResult(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cobrança & Pagamento</DialogTitle>
          </DialogHeader>

          {paymentModalAssociate ? (
            <div className="space-y-4">
              {/* Resumo do associado e valores */}
              <div className="rounded-lg bg-muted/50 p-3.5 space-y-1.5 border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{paymentModalAssociate.name}</span>
                  {paymentModalAssociate.status === "active" && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      Em dia
                    </span>
                  )}
                  {paymentModalAssociate.status === "overdue" && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      {(paymentModalAssociate.overdueMonths || 1) === 1 ? "1 mês atraso" : `${paymentModalAssociate.overdueMonths} meses atraso`}
                    </span>
                  )}
                  {paymentModalAssociate.status === "cancelled" && (
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                      Cancelado
                    </span>
                  )}
                  {(!["active", "overdue", "cancelled"].includes(paymentModalAssociate.status) || paymentModalAssociate.status === "inactive") && (
                    <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      Aguardando
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">CPF: {formatCpf(paymentModalAssociate.cpf)}</p>
                <div className="pt-1 border-t text-xs flex justify-between items-baseline font-medium">
                  <span className="text-muted-foreground">Valor da mensalidade:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {paymentModalAssociate.status === "overdue" && (paymentModalAssociate.overdueMonths || 0) > 1 ? (
                      <>
                        {formatMoney(rules.fee * paymentModalAssociate.overdueMonths!)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({paymentModalAssociate.overdueMonths}x {formatMoney(rules.fee)})
                        </span>
                      </>
                    ) : (
                      formatMoney(rules.fee)
                    )}
                  </span>
                </div>
              </div>

              {/* Botão de Recebimento no Balcão */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Recebimento presencial</p>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      O paciente pagou em dinheiro, maquininha ou Pix presencial da recepção.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="default"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  disabled={registeringCounter}
                  onClick={() => void handleCounterPayment(paymentModalAssociate)}
                >
                  <CheckCircle2 className="size-4 mr-2" />
                  {registeringCounter ? "Registrando recebimento..." : "Registrar recebimento no balcão"}
                </Button>
              </div>

              {/* Canais Digitais Asaas */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Cobrança digital Asaas
                  </span>
                  <div className="flex rounded-md border p-0.5 bg-muted">
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        selectedBillingType === "PIX"
                          ? "bg-background shadow-xs text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        setSelectedBillingType("PIX")
                        setPaymentResult(null)
                      }}
                    >
                      Pix
                    </button>
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        selectedBillingType === "BOLETO"
                          ? "bg-background shadow-xs text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        setSelectedBillingType("BOLETO")
                        setPaymentResult(null)
                      }}
                    >
                      Boleto
                    </button>
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        selectedBillingType === "CREDIT_CARD"
                          ? "bg-background shadow-xs text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        setSelectedBillingType("CREDIT_CARD")
                        setPaymentResult(null)
                      }}
                    >
                      Cartão
                    </button>
                  </div>
                </div>

                {!paymentResult ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={generatingPayment}
                    onClick={() => void generatePaymentForAssociate(paymentModalAssociate, selectedBillingType)}
                  >
                    {generatingPayment
                      ? "Gerando cobrança..."
                      : `Gerar cobrança via ${selectedBillingType === "PIX" ? "Pix" : selectedBillingType === "BOLETO" ? "Boleto" : "Cartão"}`}
                  </Button>
                ) : (
                  <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                    {/* Pix Resultado */}
                    {paymentResult.billingType === "PIX" && (
                      <div className="space-y-3 text-center">
                        {paymentResult.pix?.encodedImage ? (
                          <div className="flex justify-center">
                            <img
                              src={
                                paymentResult.pix.encodedImage.startsWith("data:")
                                  ? paymentResult.pix.encodedImage
                                  : `data:image/png;base64,${paymentResult.pix.encodedImage}`
                              }
                              alt="QR Code Pix"
                              className="size-44 rounded-md border bg-white p-2 shadow-xs"
                            />
                          </div>
                        ) : null}
                        {paymentResult.pix?.payload ? (
                          <div className="space-y-1.5 text-left">
                            <label className="text-xs font-medium text-muted-foreground">Pix Copia e Cola:</label>
                            <div className="flex gap-2">
                              <Input readOnly value={paymentResult.pix.payload} className="h-9 font-mono text-xs" />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void navigator.clipboard.writeText(paymentResult.pix!.payload).then(() => {
                                    toast.success("Código Pix copiado!")
                                  })
                                }}
                              >
                                <Copy className="size-3.5 mr-1" /> Copiar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Cobrança Pix gerada. Aguarde confirmação.</p>
                        )}
                      </div>
                    )}

                    {/* Boleto Resultado */}
                    {paymentResult.billingType === "BOLETO" && (
                      <div className="space-y-3">
                        {paymentResult.bankSlipBarcode || paymentResult.identificationField ? (
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Linha digitável / Código de barras:</label>
                            <div className="flex gap-2">
                              <Input
                                readOnly
                                value={paymentResult.bankSlipBarcode || paymentResult.identificationField || ""}
                                className="h-9 font-mono text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const code = paymentResult.bankSlipBarcode || paymentResult.identificationField || ""
                                  void navigator.clipboard.writeText(code).then(() => {
                                    toast.success("Código de barras copiado!")
                                  })
                                }}
                              >
                                <Copy className="size-3.5 mr-1" /> Copiar
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {paymentResult.bankSlipUrl ? (
                          <Button asChild className="w-full" variant="outline">
                            <a href={paymentResult.bankSlipUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4 mr-2" /> Abrir / Baixar Boleto Bancário
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    )}

                    {/* Cartão de Crédito Resultado */}
                    {paymentResult.billingType === "CREDIT_CARD" && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          O paciente preenche os dados do cartão em página protegida da Asaas para ativação da recorrência.
                        </p>
                        {paymentResult.paymentUrl ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button asChild className="w-full">
                              <a href={paymentResult.paymentUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-4 mr-2" /> Abrir link Asaas
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                void navigator.clipboard.writeText(paymentResult.paymentUrl!).then(() => {
                                  toast.success("Link copiado!")
                                })
                              }}
                            >
                              <Copy className="size-4 mr-2" /> Copiar link
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="pt-1 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground"
                        onClick={() => setPaymentResult(null)}
                      >
                        Gerar outra forma de pagamento
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </FadeIn>
  )
}

type PatientChoice = Pick<Patient, "id" | "name" | "cpf" | "phone" | "email" | "status"> & { snapshot?: Patient }

function emptyAssociateForm(): AssociateInput {
  return {
    name: "",
    cpf: "",
    phone: "",
    email: "",
    status: "inactive",
    overdueMonths: 0,
  }
}
