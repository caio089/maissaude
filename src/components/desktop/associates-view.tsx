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
  const [form, setForm] = useState<AssociateInput>(() => emptyAssociateForm(associates))
  const [errors, setErrors] = useState<FieldErrors<keyof AssociateInput>>({})

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return associates
    return associates.filter((associate) =>
      [associate.name, associate.cpf, associate.phone, associate.email].some((value) => value.toLowerCase().includes(term)),
    )
  }, [associates, query])

  function openCreate() {
    setEditing(null)
    setForm(emptyAssociateForm(associates))
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

  function save() {
    const nextErrors = validateAssociateInput(form)
    const others = associates.filter((associate) => associate.id !== editing?.id)
    if (others.some((associate) => associate.cpf.trim() === form.cpf.trim())) {
      nextErrors.cpf = "Este CPF fictício já está cadastrado como associado."
    }
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    const result = editing ? updateAssociate(editing.id, form) : createAssociate(form)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success(editing ? "Associado atualizado." : "Associado cadastrado.")
    setFormOpen(false)
  }

  return (
    <FadeIn className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Assinaturas</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Associados</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Quem está ativo paga {formatMoney(rules.fee)} e recebe o pacote de direitos. O cadastro fica neste navegador.
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
            description="Cadastre os associados fictícios. O associado ativo usa transporte, desconto na consulta pelo aplicativo e os outros direitos do pacote."
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
                    <span className="block text-xs text-muted-foreground">CPF demonstrativo {associate.cpf}</span>
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
            <Field label="CPF fictício" htmlFor="associate-cpf" error={errors.cpf} hint="Comece com 900.">
              <Input id="associate-cpf" className="h-10" value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} />
            </Field>
            <Field label="Telefone fictício" htmlFor="associate-phone" error={errors.phone}>
              <Input id="associate-phone" className="h-10" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="E-mail de demonstração" htmlFor="associate-email" error={errors.email}>
              <Input id="associate-email" className="h-10" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as PatientStatus })}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="self-end text-sm text-muted-foreground">Mensalidade de {formatMoney(rules.fee)} e o pacote de direitos para associado ativo.</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  )
}

function emptyAssociateForm(associates: Associate[]): AssociateInput {
  const used = new Set(associates.flatMap((associate) => [associate.cpf, associate.phone, associate.email.toLowerCase()]))
  for (let sequence = 1; sequence < 900; sequence += 1) {
    const code = String(sequence).padStart(3, "0")
    const cpf = `900.300.${code}-10`
    const phone = `(86) 99100-${code}0`
    const email = `associado.${code}@demonstracao.demo`
    if (!used.has(cpf) && !used.has(phone) && !used.has(email)) {
      return { name: "", cpf, phone, email, status: "active" }
    }
  }
  return {
    name: "",
    cpf: "900.300.900-10",
    phone: "(86) 99100-9000",
    email: "associado.extra@demonstracao.demo",
    status: "active",
  }
}
