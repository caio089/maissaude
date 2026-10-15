"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText } from "lucide-react"
import { toast } from "sonner"
import { FadeIn } from "@/components/shared/fade-in"
import { Field } from "@/components/shared/field"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import { SPECIALTY_LABEL } from "@/lib/types"

export function RecordsView() {
  const data = useDemoStore((state) => state.data)
  const preferredId = useDemoStore((state) => state.recordPatientId)
  const updateRecord = useDemoStore((state) => state.updateRecord)
  const patientsWithRecords = useMemo(() => {
    const ids = new Set(data.records.map((record) => record.patientId))
    return data.patients.filter((patient) => ids.has(patient.id))
  }, [data.patients, data.records])
  const [patientId, setPatientId] = useState(preferredId || patientsWithRecords[0]?.id || "")
  const activePatient = patientId || preferredId || patientsWithRecords[0]?.id || ""
  const records = data.records
    .filter((record) => record.patientId === activePatient)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "")
  const selected = records.find((record) => record.id === selectedId) ?? records[0]
  const [draft, setDraft] = useState({ notes: selected?.notes ?? "", evolution: selected?.evolution ?? "", dentalNote: selected?.dentalNote ?? "" })

  useEffect(() => {
    if (!preferredId) return
    const recordsNow = useDemoStore.getState().data.records
    setPatientId(preferredId)
    const first = recordsNow.find((record) => record.patientId === preferredId)
    if (!first) return
    setSelectedId(first.id)
    setDraft({ notes: first.notes, evolution: first.evolution, dentalNote: first.dentalNote ?? "" })
  }, [preferredId])

  function selectRecord(id: string) {
    const record = data.records.find((item) => item.id === id)
    setSelectedId(id)
    setDraft({ notes: record?.notes ?? "", evolution: record?.evolution ?? "", dentalNote: record?.dentalNote ?? "" })
  }

  function selectPatient(id: string) {
    setPatientId(id)
    const first = data.records.find((record) => record.patientId === id)
    selectRecord(first?.id ?? "")
  }

  return (
    <FadeIn className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Prontuários</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Registros fictícios para a apresentação. A estrutura aceita odontologia e as demais especialidades, sem diagnóstico ou recomendação clínica.
        </p>
      </div>
      {patientsWithRecords.length === 0 ? (
        <div className="panel">
          <EmptyState icon={FileText} title="Nenhum prontuário no roteiro" description="As consultas realizadas da demonstração geram a linha do tempo." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="panel max-h-[70dvh] overflow-y-auto p-2">
            {patientsWithRecords.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => selectPatient(patient.id)}
                className={`block w-full rounded-xl px-3 py-3 text-left ${patient.id === activePatient ? "bg-accent" : "hover:bg-muted"}`}
              >
                <span className="block text-sm font-medium">{patient.name}</span>
                <span className="block text-xs text-muted-foreground">{data.records.filter((record) => record.patientId === patient.id).length} registros</span>
              </button>
            ))}
          </aside>
          <section className="panel p-5">
            {selected ? (
              <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
                <ol className="space-y-3">
                  {records.map((record) => (
                    <li key={record.id}>
                      <button type="button" onClick={() => selectRecord(record.id)} className={`w-full rounded-2xl px-3 py-3 text-left ring-1 ${record.id === selected.id ? "bg-primary text-primary-foreground ring-primary" : "ring-border"}`}>
                        <span className="block text-sm font-medium">{formatDate(record.date, "dd MMM yyyy")}</span>
                        <span className={`block text-xs ${record.id === selected.id ? "text-white/75" : "text-muted-foreground"}`}>{SPECIALTY_LABEL[record.specialty]}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-teal">Demonstração</p>
                    <h2 className="text-xl font-semibold">{SPECIALTY_LABEL[selected.specialty]}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{selected.complaint}</p>
                  </div>
                  <Field label="Anotação administrativa" htmlFor="record-notes">
                    <Textarea id="record-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
                  </Field>
                  <Field label="Evolução fictícia" htmlFor="record-evolution">
                    <Textarea id="record-evolution" value={draft.evolution} onChange={(event) => setDraft((current) => ({ ...current, evolution: event.target.value }))} />
                  </Field>
                  {selected.specialty === "odontologia" ? (
                    <Field label="Observação odontológica" htmlFor="record-dental" hint="Campo reservado à odontologia, sem impedir outras especialidades.">
                      <Textarea id="record-dental" value={draft.dentalNote} onChange={(event) => setDraft((current) => ({ ...current, dentalNote: event.target.value }))} />
                    </Field>
                  ) : null}
                  <div className="rounded-2xl bg-muted/70 p-4 text-sm">
                    <p className="font-medium">Prescrição demonstrativa</p>
                    {selected.prescriptions.map((item) => (
                      <p key={item.id} className="mt-2 text-muted-foreground">{item.label}: {item.instructions}</p>
                    ))}
                    <p className="mt-3 font-medium">Documento demonstrativo</p>
                    {selected.documents.map((item) => (
                      <p key={item.id} className="mt-2 text-muted-foreground">{item.title} · {item.kind}</p>
                    ))}
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      updateRecord(selected.id, draft)
                      toast.success("Prontuário de demonstração salvo neste navegador.")
                    }}
                  >
                    Salvar alterações
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState icon={FileText} title="Selecione um paciente" description="A linha do tempo aparece aqui." />
            )}
          </section>
        </div>
      )}
    </FadeIn>
  )
}
