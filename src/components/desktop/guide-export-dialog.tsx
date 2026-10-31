"use client"

import { useEffect, useState } from "react"
import { Download, Printer, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createAuthorizationGuide,
  downloadBlob,
  guideCredentials,
  printAuthorizationGuide,
  type AuthorizationGuideInput,
} from "@/lib/authorization-guide"

export type GuideDialogItem = {
  id: string
  issuedAt: string
  valid: boolean
  appointmentStatus: string | null
  startsAt: string | null
  patient: { id: string; name: string; cpf: string; birthDate?: string } | null
  professional: string
  service: string
  paymentStatus: string
  guideInput?: AuthorizationGuideInput
}

interface GuideExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guide: GuideDialogItem | null
}

export function GuideExportDialog({ open, onOpenChange, guide }: GuideExportDialogProps) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [printing, setPrinting] = useState(false)

  const credentials = guide ? guideCredentials(guide.id) : null

  useEffect(() => {
    if (!open || !guide) {
      setBlob(null)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    let active = true
    let createdUrl: string | null = null
    setGenerating(true)

    const guideInput: AuthorizationGuideInput = guide.guideInput || {
      reference: guide.id,
      authorizedAt: guide.issuedAt,
      patient: {
        name: guide.patient?.name || "Paciente",
        cpf: guide.patient?.cpf || "",
        birthDate: guide.patient?.birthDate || "2000-01-01",
      },
      clinic: {
        name: "CuidarSaude",
        phone: "(85) 3000-0000",
        address: "Rua Exemplo, 123",
        city: "Fortaleza/CE",
      },
      appointmentAt: guide.startsAt || guide.issuedAt,
      professional: {
        name: guide.professional,
        specialtyLabel: "Clínica geral",
        credentialLabel: "CRM",
        credentialCode: "0000",
        location: "Clínica CuidarSaude",
        startHour: "08:00",
        endHour: "18:00",
      },
      serviceName: guide.service,
    }

    createAuthorizationGuide(guideInput)
      .then((generatedBlob) => {
        if (!active) return
        createdUrl = URL.createObjectURL(generatedBlob)
        setBlob(generatedBlob)
        setPreviewUrl(createdUrl)
      })
      .catch(() => {
        if (active) toast.error("Não foi possível gerar a imagem da guia.")
      })
      .finally(() => {
        if (active) setGenerating(false)
      })

    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [open, guide])

  const handleDownload = () => {
    if (!blob || !credentials) return
    downloadBlob(blob, `guia-cuidarsaude-${credentials.number}.png`)
    toast.success("Download da guia iniciado.")
  }

  const handlePrint = async () => {
    if (!blob || !credentials) return
    setPrinting(true)
    try {
      await printAuthorizationGuide(blob, `Guia ${credentials.number} - CuidarSaude`)
    } catch {
      toast.error("Não foi possível acionar a impressão.")
    } finally {
      setPrinting(false)
    }
  }

  if (!guide) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-xl">Exportar Guia de Autorização</DialogTitle>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                guide.valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}
            >
              {guide.valid ? "Guia Válida" : "Guia Não Válida"}
            </span>
          </div>
          <DialogDescription>
            {guide.patient?.name ? `Paciente: ${guide.patient.name} · ` : ""}
            {credentials ? `Guia nº ${credentials.number} (senha: ${credentials.password})` : `ID: ${guide.id}`}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 flex min-h-64 flex-col items-center justify-center rounded-xl border bg-muted/30 p-3">
          {generating ? (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-teal" />
              <p>Gerando guia oficial em alta resolução...</p>
            </div>
          ) : previewUrl ? (
            <div className="w-full max-w-lg overflow-hidden rounded-lg border bg-white shadow-sm">
              <img
                src={previewUrl}
                alt={`Guia de autorização ${credentials?.number || guide.id}`}
                className="w-full object-contain"
              />
            </div>
          ) : (
            <p className="text-sm text-destructive">Falha ao carregar a pré-visualização.</p>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!blob || generating || printing}
            onClick={handlePrint}
            className="gap-1.5"
          >
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir / Salvar PDF
          </Button>
          <Button
            type="button"
            disabled={!blob || generating}
            onClick={handleDownload}
            className="gap-1.5 bg-teal text-white hover:bg-teal/90"
          >
            <Download className="h-4 w-4" />
            Baixar imagem (PNG)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
