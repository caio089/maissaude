"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Copy, CreditCard, ExternalLink, IdCard, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { AssociateRulesCard } from "@/components/desktop/associate-rules-card"
import { FlowSteps } from "@/components/shared/flow-steps"
import { Field } from "@/components/shared/field"
import { EmptyState } from "@/components/shared/empty-state"
import { FadeIn } from "@/components/shared/fade-in"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CreditCardFormData,
  CreditCardFormErrors,
  CreditCardFormFields,
  validateCreditCardForm,
} from "@/components/shared/credit-card-form"
import { formatDate, formatMoney } from "@/lib/format"
import { cpfDigits, formatCpf } from "@/lib/cpf"
import { useDemoStore } from "@/lib/store"
import type { Associate, AssociateInput, AssociateStatus, ClinicRole, Patient } from "@/lib/types"
import { hasErrors, validateAssociateInput, type FieldErrors } from "@/lib/validation"

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD"
type StatusFilter = "active" | "inactive" | "overdue" | "cancelled" | "all"

type PaymentResult = {
  billingType: BillingType
  value: number
  paymentUrl?: string
  pix?: { payload: string; encodedImage: string } | null
  bankSlipUrl?: string | null
  bankSlipBarcode?: string | null
  identificationField?: string | null
  approved?: boolean
}

export interface AssociatesViewProps {
  initialRole?: ClinicRole
  role?: ClinicRole
}

export function AssociatesView({ initialRole, role: propRole }: AssociatesViewProps = {}) {
  const [role, setRole] = useState<ClinicRole | null>(propRole ?? initialRole ?? null)
  const associates = useDemoStore((state) => state.associates)
  const localPatients = useDemoStore((state) => state.data.patients)
  const rules = useDemoStore((state) => state.associateRules)
  const createAssociate = useDemoStore((state) => state.createAssociate)
  const updateAssociate = useDemoStore((state) => state.updateAssociate)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Associate | null>(null)
  const [form, setForm] = useState<AssociateInput>(() => emptyAssociateForm())
  const [modalStep, setModalStep] = useState(0)
  const [errors, setErrors] = useState<FieldErrors<keyof AssociateInput>>({})
  const [newAssociateBillingType, setNewAssociateBillingType] = useState<BillingType>("PIX")
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState<"new" | "patient">("new")
  const [patientQuery, setPatientQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<PatientChoice | null>(null)
  const [serverPatients, setServerPatients] = useState<PatientChoice[]>([])
  const [serverAssociates, setServerAssociates] = useState<Associate[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)

  const [paymentModalAssociate, setPaymentModalAssociate] = useState<Associate | null>(null)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [generatingPayment, setGeneratingPayment] = useState(false)
  const [registeringCounter, setRegisteringCounter] = useState(false)

  const [cardForm, setCardForm] = useState<CreditCardFormData>({
    number: "",
    holderName: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
    postalCode: "",
    addressNumber: "",
  })
  const [cardErrors, setCardErrors] = useState<CreditCardFormErrors>({})

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

  useEffect(() => {
    if (propRole || initialRole) return
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
  }, [propRole, initialRole])

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
    let inactive = 0
    for (const item of allAssociates) {
      if (item.status === "active") active++
      else if (item.status === "overdue") overdue++
      else if (item.status === "cancelled") cancelled++
      else inactive++
    }
    return {
      all: allAssociates.length,
      active,
      inactive,
      overdue,
      cancelled,
    }
  }, [allAssociates])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return allAssociates.filter((associate) => {
      if (statusFilter !== "all") {
        if (statusFilter === "inactive") {
          if (associate.status !== "inactive" && ["active", "overdue", "cancelled"].includes(associate.status)) {
            return false
          }
        } else if (associate.status !== statusFilter) {
          return false
        }
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
    setModalStep(0)
    setPaymentModalAssociate(null)
    setPaymentResult(null)
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
    setModalStep(0)
    setPaymentModalAssociate(null)
    setPaymentResult(null)
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
    setModalStep(2)
    setPaymentModalAssociate(associate)
    setPaymentResult(null)
  }

  async function handleProcessCreditCard(target: Associate) {
    const v = validateCreditCardForm(cardForm)
    if (Object.keys(v).length > 0) {
      setCardErrors(v)
      return
    }
    setCardErrors({})
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
          billingType: "CREDIT_CARD",
          monthsToPay: target.overdueMonths && target.overdueMonths > 0 ? target.overdueMonths : 1,
          creditCard: {
            holderName: cardForm.holderName.trim().toUpperCase(),
            number: cardForm.number.replace(/\D/g, ""),
            expiryMonth: cardForm.expiryMonth,
            expiryYear: cardForm.expiryYear,
            ccv: cardForm.ccv,
          },
          creditCardHolderInfo: {
            postalCode: cardForm.postalCode.replace(/\D/g, ""),
            addressNumber: cardForm.addressNumber.trim(),
          },
        }),
      })
      const body = (await response.json()) as { error?: string; status?: string; value?: number; paymentUrl?: string }
      if (!response.ok || body.error) {
        toast.error(body.error || "Não foi possível aprovar o cartão.")
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
      setPaymentResult({
        billingType: "CREDIT_CARD",
        value: body.value || (target.overdueMonths && target.overdueMonths > 0 ? target.overdueMonths : 1) * rules.fee,
        approved: true,
      })
      toast.success("Pagamento com cartão aprovado! Associado regularizado e ativo.")
    } catch {
      toast.error("Erro ao processar cartão.")
    } finally {
      setGeneratingPayment(false)
    }
  }

  async function generatePaymentForAssociate(target: Associate, method: BillingType) {
    if (method === "CREDIT_CARD") {
      setCardForm((prev) => ({
        ...prev,
        holderName: prev.holderName || target.name.toUpperCase(),
      }))
      setCardErrors({})
      setPaymentResult({
        billingType: "CREDIT_CARD",
        value: (target.overdueMonths && target.overdueMonths > 0 ? target.overdueMonths : 1) * rules.fee,
      })
      return
    }
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
      if (newAssociateBillingType === "CREDIT_CARD") {
        const v = validateCreditCardForm(cardForm)
        if (Object.keys(v).length > 0) {
          setCardErrors(v)
          return
        }
        setCardErrors({})
      }

      setSaving(true)
      try {
        const payload: any = {
          ...normalizedForm,
          billingType: newAssociateBillingType,
          patientId: selectedPatient?.id,
          patient: selectedPatient?.snapshot,
        }
        if (newAssociateBillingType === "CREDIT_CARD") {
          payload.creditCard = {
            holderName: cardForm.holderName.trim().toUpperCase(),
            number: cardForm.number.replace(/\D/g, ""),
            expiryMonth: cardForm.expiryMonth,
            expiryYear: cardForm.expiryYear,
            ccv: cardForm.ccv,
          }
          payload.creditCardHolderInfo = {
            postalCode: cardForm.postalCode.replace(/\D/g, ""),
            addressNumber: cardForm.addressNumber.trim(),
          }
        }

        const response = await fetch("/api/payments/associate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const body = (await response.json()) as {
          error?: string
          associateId?: string
          value?: number
          billingType?: BillingType
          paymentUrl?: string
          status?: string
          pix?: { payload: string; encodedImage: string } | null
          bankSlipUrl?: string | null
          bankSlipBarcode?: string | null
          identificationField?: string | null
        }
        if (!response.ok || !body.value || !body.associateId) {
          toast.error(body.error || "Não foi possível gerar a cobrança.")
          return
        }
        const isApproved = newAssociateBillingType === "CREDIT_CARD" && body.status === "active"
        const newAss: Associate = {
          id: body.associateId,
          name: normalizedForm.name,
          cpf: normalizedForm.cpf,
          phone: normalizedForm.phone,
          email: normalizedForm.email,
          status: isApproved ? "active" : "inactive",
          overdueMonths: 0,
          createdAt: new Date().toISOString(),
          lastPaidAt: isApproved ? new Date().toISOString() : undefined,
        }
        const result = createAssociate(newAss, body.associateId)
        if (!result.ok) {
          toast.warning("Cobrança criada, mas a lista local não foi atualizada.")
        }
        setServerAssociates((prev) => [newAss, ...prev])
        setModalStep(2)
        setPaymentModalAssociate(newAss)
        setPaymentResult({
          billingType: newAssociateBillingType,
          value: body.value,
          paymentUrl: body.paymentUrl,
          pix: body.pix,
          bankSlipUrl: body.bankSlipUrl,
          bankSlipBarcode: body.bankSlipBarcode || body.identificationField,
          identificationField: body.identificationField,
          approved: isApproved,
        })
        toast.success(
          isApproved
            ? "Associado cadastrado e cartão aprovado com sucesso!"
            : "Associado cadastrado e cobrança gerada com sucesso!",
        )
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
    setModalStep(0)
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

      <AssociateRulesCard role={role ?? undefined} />

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
              aria-selected={statusFilter === "inactive"}
              onClick={() => setStatusFilter("inactive")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === "inactive"
                  ? "bg-background text-sky-700 shadow-xs font-semibold dark:text-sky-400"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              Aguardando
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  statusFilter === "inactive"
                    ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {counts.inactive}
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
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={IdCard}
            title={
              query
                ? "Nenhum associado encontrado"
                : statusFilter === "active"
                ? "Nenhum associado ativo (em dia)"
                : statusFilter === "inactive"
                ? "Nenhum associado aguardando ativação"
                : statusFilter === "overdue"
                ? "Nenhum associado em atraso"
                : statusFilter === "cancelled"
                ? "Nenhum associado cancelado"
                : "Nenhum associado cadastrado"
            }
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
                  Ver todos os associados
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
                  <TableCell>{formatDate(associate.createdAt || (associate as { created_at?: string }).created_at, "dd/MM/yyyy")}</TableCell>
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
      <Dialog open={formOpen} onOpenChange={(open) => { if (!saving) { setFormOpen(open); if (!open) setEditing(null); } }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar associado: ${editing.name}` : "Novo associado"}</DialogTitle>
            {editing && (
              <DialogDescription>
                Atualize os dados cadastrais ou a situação da assinatura do associado.
              </DialogDescription>
            )}
          </DialogHeader>

          {editing ? (
            /* Formulário direto de edição (sem etapas de checkout) */
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome" htmlFor="associate-name" error={errors.name}>
                  <Input id="associate-name" className="h-10" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </Field>
                <Field label="CPF" htmlFor="associate-cpf" error={errors.cpf}>
                  <Input id="associate-cpf" className="h-10" inputMode="numeric" placeholder="Somente números" value={form.cpf} onChange={(event) => setForm({ ...form, cpf: formatCpf(event.target.value) })} />
                </Field>
                <Field label="Telefone" htmlFor="associate-phone" error={errors.phone}>
                  <Input id="associate-phone" className="h-10" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </Field>
                <Field label="E-mail" htmlFor="associate-email" error={errors.email}>
                  <Input id="associate-email" className="h-10" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Situação do plano">
                    <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as AssociateStatus })}>
                      <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo (Em dia)</SelectItem>
                        <SelectItem value="inactive">Inativo (Aguardando pagamento)</SelectItem>
                        <SelectItem value="overdue">Em atraso</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>

              {form.status !== "cancelled" ? (
                <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-destructive">Deseja cancelar esta associação?</p>
                    <p className="text-[11px] text-muted-foreground">O associado perderá os benefícios do plano de descontos.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-8"
                    onClick={() => setForm({ ...form, status: "cancelled" })}
                  >
                    Definir como Cancelado
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Este associado está marcado como Cancelado.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Para reativá-lo, mude a situação acima para &quot;Ativo (Em dia)&quot; e salve as alterações.
                  </p>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false)
                    setEditing(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" disabled={saving} onClick={() => void save()}>
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Fluxo de Criação de Novo Associado */
            <>
              <FlowSteps steps={["Dados", "Cobrança", "Pagamento"]} current={modalStep} />
              {modalStep === 0 && (
                <>
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nome" htmlFor="associate-name" error={errors.name}>
                      <Input id="associate-name" className="h-10" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                    </Field>
                    <Field label="CPF" htmlFor="associate-cpf" error={errors.cpf}>
                      <Input id="associate-cpf" className="h-10" inputMode="numeric" placeholder="Somente números" value={form.cpf} disabled={source === "patient" && Boolean(selectedPatient)} onChange={(event) => setForm({ ...form, cpf: formatCpf(event.target.value) })} />
                    </Field>
                    <Field label="Telefone" htmlFor="associate-phone" error={errors.phone}>
                      <Input id="associate-phone" className="h-10" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                    </Field>
                    <Field label="E-mail" htmlFor="associate-email" error={errors.email}>
                      <Input id="associate-email" className="h-10" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                    </Field>
                    <div className="sm:col-span-2">
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
                    </div>
                    <p className="self-end text-sm text-muted-foreground sm:col-span-2">
                      Mensalidade de {formatMoney(rules.fee)}. A associação é ativada automaticamente com a confirmação ou recebimento presencial.
                    </p>
                  </div>
                </>
              )}
              {modalStep === 1 && (
                <>
                  <section className="space-y-4 rounded-lg border p-4">
                    <div>
                      <p className="text-sm font-semibold">{form.name}</p>
                      <p className="text-xs text-muted-foreground">CPF {formatCpf(form.cpf)} · Mensalidade {formatMoney(rules.fee)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Forma de pagamento">
                      {(["PIX", "BOLETO", "CREDIT_CARD"] as BillingType[]).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setNewAssociateBillingType(method)}
                          className={`rounded-md border p-2 text-xs font-medium transition-all ${
                            newAssociateBillingType === method
                              ? "border-teal bg-accent text-teal font-semibold"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {method === "PIX" ? "Pix" : method === "BOLETO" ? "Boleto" : "Cartão"}
                        </button>
                      ))}
                    </div>
                    {newAssociateBillingType === "BOLETO" ? (
                      <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">O boleto pode levar até 3 dias úteis para compensar.</p>
                    ) : null}
                    {newAssociateBillingType === "CREDIT_CARD" ? (
                      <CreditCardFormFields
                        value={cardForm}
                        onChange={setCardForm}
                        errors={cardErrors}
                        disabled={saving}
                      />
                    ) : null}
                  </section>
                </>
              )}
              {modalStep === 2 && paymentResult && paymentModalAssociate ? (
                <PaymentResultPanel
                  result={paymentResult}
                  associate={paymentModalAssociate}
                  rules={rules}
                  registeringCounter={registeringCounter}
                  generatingPayment={generatingPayment}
                  cardForm={cardForm}
                  onCardFormChange={setCardForm}
                  cardErrors={cardErrors}
                  onProcessCard={() => void handleProcessCreditCard(paymentModalAssociate)}
                  onCounterPayment={() => void handleCounterPayment(paymentModalAssociate)}
                  onGenerate={(method) => void generatePaymentForAssociate(paymentModalAssociate, method)}
                  onReset={() => setPaymentResult(null)}
                />
              ) : null}
              <DialogFooter>
                {modalStep === 0 ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFormOpen(false)
                        setEditing(null)
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={saving || (source === "patient" && !selectedPatient)}
                      onClick={() => {
                        if (form.name && !cardForm.holderName) {
                          setCardForm((prev) => ({ ...prev, holderName: form.name.toUpperCase() }))
                        }
                        setModalStep(1)
                      }}
                    >
                      {saving ? "Processando..." : "Continuar"}
                    </Button>
                  </>
                ) : modalStep === 1 ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => setModalStep(0)}>Voltar</Button>
                    <Button type="button" disabled={saving} onClick={() => void save()}>
                      {saving
                        ? "Processando..."
                        : newAssociateBillingType === "CREDIT_CARD"
                        ? `Cadastrar e processar cartão (${formatMoney(rules.fee)})`
                        : "Cadastrar e gerar cobrança"}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setPaymentModalAssociate(null); setPaymentResult(null) }}>Concluir</Button>
                )}
              </DialogFooter>
            </>
          )}
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

function PaymentResultPanel({
  result,
  associate,
  rules,
  registeringCounter,
  generatingPayment,
  cardForm,
  onCardFormChange,
  cardErrors,
  onProcessCard,
  onCounterPayment,
  onGenerate,
  onReset,
}: {
  result: PaymentResult
  associate: Associate
  rules: { fee: number }
  registeringCounter: boolean
  generatingPayment: boolean
  cardForm: CreditCardFormData
  onCardFormChange: (updater: (prev: CreditCardFormData) => CreditCardFormData) => void
  cardErrors: CreditCardFormErrors
  onProcessCard: () => void
  onCounterPayment: () => void
  onGenerate: (method: BillingType) => void
  onReset: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-3.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{associate.name}</span>
          <span className="text-xs text-muted-foreground">{associate.status === "active" ? "Em dia" : associate.status === "overdue" ? "Em atraso" : associate.status}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">CPF {formatCpf(associate.cpf)} · Mensalidade {formatMoney(rules.fee)}</p>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2">
        <p className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Recebimento presencial</p>
        <p className="text-xs text-emerald-800">Registre pagamento em dinheiro, maquininha ou Pix presencial.</p>
        <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={registeringCounter} onClick={onCounterPayment}>
          <CheckCircle2 className="mr-2 size-4" />
          {registeringCounter ? "Registrando..." : "Registrar recebimento no balcão"}
        </Button>
      </div>

      <section className="space-y-3 rounded-lg border p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Cobrança digital</p>
            <p className="text-sm font-semibold">{formatMoney(result.value)} · {result.billingType === "PIX" ? "Pix" : result.billingType === "BOLETO" ? "Boleto" : "Cartão"}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onReset}>Trocar método</Button>
        </div>

        {result.billingType === "PIX" ? (
          <div className="space-y-3 text-center">
            {result.pix?.encodedImage ? (
              <img
                src={result.pix.encodedImage.startsWith("data:") ? result.pix.encodedImage : `data:image/png;base64,${result.pix.encodedImage}`}
                alt="QR Code Pix"
                className="mx-auto size-40 rounded-md border bg-white p-2"
              />
            ) : null}
            {result.pix?.payload ? (
              <div className="space-y-2 text-left">
                <Input readOnly value={result.pix.payload} className="font-mono text-xs" aria-label="Pix copia e cola" />
                <Button type="button" variant="outline" className="w-full" onClick={() => void navigator.clipboard.writeText(result.pix!.payload).then(() => toast.success("Código Pix copiado!"))}>
                  <Copy className="mr-2 size-4" /> Copiar Pix
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">A cobrança foi criada. Aguarde a confirmação.</p>
            )}
          </div>
        ) : null}

        {result.billingType === "BOLETO" ? (
          <div className="space-y-3">
            {result.bankSlipBarcode || result.identificationField ? (
              <div className="space-y-2">
                <Input readOnly value={result.bankSlipBarcode || result.identificationField || ""} className="font-mono text-xs" aria-label="Linha digitável do boleto" />
                <Button type="button" variant="outline" className="w-full" onClick={() => void navigator.clipboard.writeText(result.bankSlipBarcode || result.identificationField || "").then(() => toast.success("Linha digitável copiada!"))}>
                  <Copy className="mr-2 size-4" /> Copiar linha digitável
                </Button>
              </div>
            ) : null}
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">O boleto pode levar até 3 dias úteis para compensar.</p>
            {result.bankSlipUrl ? (
              <Button asChild variant="outline" className="w-full">
                <a href={result.bankSlipUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4" /> Abrir boleto</a>
              </Button>
            ) : null}
          </div>
        ) : null}

        {result.billingType === "CREDIT_CARD" ? (
          <div className="space-y-3">
            {result.approved ? (
              <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-5" />
                </span>
                <p className="text-sm font-semibold text-emerald-950">Pagamento com cartão aprovado!</p>
                <p className="text-xs text-emerald-800">
                  A assinatura foi processada no Asaas com sucesso e o associado agora está Ativo (Em dia).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <CreditCardFormFields
                  value={cardForm}
                  onChange={onCardFormChange}
                  errors={cardErrors}
                  disabled={generatingPayment}
                />
                <Button
                  type="button"
                  className="w-full h-11"
                  disabled={generatingPayment}
                  onClick={onProcessCard}
                >
                  {generatingPayment ? "Processando cartão..." : `Cobrar cartão · ${formatMoney(result.value)}`}
                </Button>
                {result.paymentUrl ? (
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    Ou se preferir:{" "}
                    <a href={result.paymentUrl} target="_blank" rel="noreferrer" className="text-teal underline inline-flex items-center gap-1">
                      Abrir link externo do Asaas <ExternalLink className="size-3" />
                    </a>
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          {(["PIX", "BOLETO", "CREDIT_CARD"] as BillingType[]).map((method) => (
            <Button key={method} type="button" variant="outline" className="text-xs" onClick={() => onGenerate(method)} disabled={generatingPayment}>
              {generatingPayment ? "Gerando..." : `Gerar ${method === "PIX" ? "Pix" : method === "BOLETO" ? "Boleto" : "Cartão"}`}
            </Button>
          ))}
        </div>
      </section>
    </div>
  )
}
