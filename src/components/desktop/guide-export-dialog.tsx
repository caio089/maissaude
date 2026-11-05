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
  photoUrl?: string | null
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

    const baseGuideInput = guide.guideInput
    const guideInput: AuthorizationGuideInput = baseGuideInput
      ? {
          ...baseGuideInput,
          professional: {
            ...baseGuideInput.professional,
            photoUrl: baseGuideInput.professional.photoUrl ?? guide.photoUrl ?? null,
          },
        }
      : {
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
            photoUrl: guide.photoUrl ?? null,
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
    if (!blob || !credentials) {
      toast.error("Aguarde o carregamento da imagem da guia para baixar.")
      return
    }
    try {
      downloadBlob(blob, `guia-cuidarsaude-${credentials.number}.png`)
      toast.success("Download da guia em PNG iniciado.")
    } catch {
      toast.error("Não foi possível iniciar o download da guia.")
    }
  }

  const handlePrint = async () => {
    if (!blob || !credentials) {
      toast.error("Aguarde o carregamento da imagem da guia para imprimir.")
      return
    }
    setPrinting(true)
    try {
      await printAuthorizationGuide(blob, `Guia ${credentials.number} - CuidarSaude`)
      toast.success("Diálogo de impressão aberto.")
    } catch {
      toast.error("Não foi possível acionar a impressão.")
    } finally {
      setPrinting(false)
    }
  }

  if (!guide) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[92vh] sm:max-h-[88vh] max-w-2xl p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b flex-shrink-0 bg-background">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-lg sm:text-xl font-semibold">Exportar Guia de Autorização</DialogTitle>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                guide.valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}
            >
              {guide.valid ? "Guia Válida" : "Guia Não Válida"}
            </span>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
            {guide.patient?.name ? `Paciente: ${guide.patient.name} · ` : ""}
            {credentials ? `Guia nº ${credentials.number} (senha: ${credentials.password})` : `ID: ${guide.id}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center bg-muted/20">
          {generating ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-7 w-7 animate-spin text-teal" />
              <p className="font-medium">Gerando guia oficial em alta resolução...</p>
              <span className="sr-only">Carregando visualização da guia</span>
            </div>
          ) : previewUrl ? (
            <div className="flex w-full items-center justify-center">
              <div className="relative max-h-[48vh] sm:max-h-[54vh] max-w-full overflow-hidden rounded-lg border bg-white shadow-sm transition-transform hover:shadow-md">
                <img
                  src={previewUrl}
                  alt={`Guia de autorização ${credentials?.number || guide.id} do paciente ${guide.patient?.name || ""}`}
                  className="max-h-[48vh] sm:max-h-[54vh] w-auto max-w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="py-10 text-center" role="alert">
              <p className="text-sm font-medium text-destructive">Falha ao carregar a pré-visualização.</p>
              <p className="mt-1 text-xs text-muted-foreground">Tente fechar e abrir novamente a exportação.</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 sm:px-6 border-t bg-background flex-shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar janela"
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!blob || generating || printing}
            onClick={handlePrint}
            aria-label="Imprimir guia ou salvar como PDF"
            className="gap-1.5 w-full sm:w-auto"
          >
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir / Salvar PDF
          </Button>
          <Button
            type="button"
            disabled={!blob || generating}
            onClick={handleDownload}
            aria-label="Baixar guia como imagem PNG"
            className="gap-1.5 bg-teal text-white hover:bg-teal/90 w-full sm:w-auto shadow-sm"
          >
            <Download className="h-4 w-4" />
            Baixar imagem (PNG)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
