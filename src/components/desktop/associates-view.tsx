"use client"

import { useMemo, useState } from "react"
import { IdCard, Plus, Search } from "lucide-react"
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
import type { Associate, AssociateInput, PatientStatus } from "@/lib/types"
import { hasErrors, validateAssociateInput, type FieldErrors } from "@/lib/validation"

export function AssociatesView() {
  const associates = useDemoStore((state) => state.associates)
  const rules = useDemoStore((state) => state.associateRules)
  const createAssociate = useDemoStore((state) => state.createAssociate)
  const updateAssociate = useDemoStore((state) => state.updateAssociate)
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Associate | null>(null)
  const [form, setForm] = useState<AssociateInput>(() => emptyAssociateForm())
  const [errors, setErrors] = useState<FieldErrors<keyof AssociateInput>>({})
  const [payment, setPayment] = useState<{ value: number; payload: string | null; encodedImage: string | null; invoiceUrl: string | null } | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return associates
    return associates.filter((associate) =>
      [associate.name, associate.cpf, associate.phone, associate.email].some((value) => value.toLowerCase().includes(term)),
    )
  }, [associates, query])

  function openCreate() {
    setEditing(null)
    setForm(emptyAssociateForm())
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(associate: Associate) {
    setEditing(associate)
    setForm({
      name: associate.name,
      cpf: associate.cpf,
      phone: associate.phone,
      email: associate.email,
      status: associate.status,
    })
    setErrors({})
    setFormOpen(true)
  }

  async function save() {
    const normalizedForm = { ...form, cpf: cpfDigits(form.cpf), phone: form.phone.trim(), email: form.email.trim().toLowerCase() }
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
          body: JSON.stringify(normalizedForm),
        })
        const body = await response.json() as { error?: string; value?: number; pix?: { payload?: string | null; encodedImage?: string | null } | null; invoiceUrl?: string | null }
        if (!response.ok || !body.value) {
          toast.error(body.error || "Não foi possível gerar o Pix.")
          return
        }
        const result = createAssociate({ ...normalizedForm, status: "inactive" })
        if (!result.ok) {
          toast.error(result.message)
          return
        }
        setPayment({
          value: body.value,
          payload: body.pix?.payload || null,
          encodedImage: body.pix?.encodedImage || null,
          invoiceUrl: body.invoiceUrl || null,
        })
        setFormOpen(false)
        toast.success("Cadastro criado e Pix gerado. A associação será ativada após a confirmação.")
        return
      } finally {
        setSaving(false)
      }
    }

    const result = updateAssociate(editing.id, normalizedForm)
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
            Cadastre presencialmente e gere o Pix da primeira mensalidade. A associação é ativada quando o Asaas confirmar o pagamento.
          </p>
        </div>
        <Button type="button" onClick={openCreate}><Plus /> Novo associado</Button>
      </div>

      <AssociateRulesCard />

      <div className="panel p-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, CPF, telefone ou e-mail" aria-label="Pesquisar associados" className="h-10 pl-9" />
        </div>
      </div>

      <div className="panel overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={IdCard}
            title="Nenhum associado cadastrado"
            description="Cadastre os associados e acompanhe os benefícios vinculados ao plano."
            action={<Button type="button" onClick={openCreate}>Cadastrar</Button>}
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
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((associate) => (
                <TableRow key={associate.id}>
                  <TableCell>
                    <span className="block font-medium">{associate.name}</span>
                    <span className="block text-xs text-muted-foreground">CPF {associate.cpf}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block">{associate.phone}</span>
                    <span className="block text-xs text-muted-foreground">{associate.email}</span>
                  </TableCell>
                  <TableCell>{associate.status === "active" ? formatMoney(rules.fee) : "—"}</TableCell>
                  <TableCell>{associate.status === "active" ? "Ativo" : "Inativo"}</TableCell>
                  <TableCell>{formatDate(associate.createdAt, "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(associate)}>Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar associado" : "Novo associado"}</DialogTitle>
          </DialogHeader>
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
            <Field label="Status">
              <Select value={form.status} disabled={!editing} onValueChange={(value) => setForm({ ...form, status: value as PatientStatus })}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="self-end text-sm text-muted-foreground">Mensalidade de {formatMoney(rules.fee)}. Novos associados ficam pendentes até o Pix ser pago.</p>
          </div>
          <DialogFooter>
            <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Gerando Pix..." : editing ? "Salvar" : "Cadastrar e gerar Pix"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(payment)} onOpenChange={(open) => { if (!open) setPayment(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Pix da primeira mensalidade</DialogTitle></DialogHeader>
          {payment ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Valor: <strong className="text-foreground">{formatMoney(payment.value)}</strong>. Após a confirmação do Asaas, o associado será ativado.</p>
              {payment.encodedImage ? <img className="mx-auto size-56" src={`data:image/png;base64,${payment.encodedImage}`} alt="QR Code Pix para pagamento da mensalidade" /> : null}
              {payment.payload ? <Button type="button" variant="outline" className="w-full" onClick={() => { if (payment.payload) void navigator.clipboard.writeText(payment.payload).then(() => toast.success("Código Pix copiado.")) }}>Copiar código Pix</Button> : null}
              {payment.invoiceUrl ? <Button asChild className="w-full"><a href={payment.invoiceUrl} target="_blank" rel="noreferrer">Abrir cobrança Asaas</a></Button> : null}
              {!payment.encodedImage && !payment.payload ? <p className="rounded-xl bg-muted p-3 text-sm">A cobrança foi criada. Abra a cobrança Asaas para exibir o Pix.</p> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </FadeIn>
  )
}

function emptyAssociateForm(): AssociateInput {
  return {
    name: "",
    cpf: "",
    phone: "",
    email: "",
    status: "inactive",
  }
}
