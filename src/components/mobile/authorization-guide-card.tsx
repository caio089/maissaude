"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createAuthorizationGuide, downloadBlob, guideCredentials, type AuthorizationGuideInput } from "@/lib/authorization-guide"

export function AuthorizationGuideCard({ input }: { input: AuthorizationGuideInput }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const credentials = guideCredentials(input.reference)

  useEffect(() => {
    let active = true
    let url: string | null = null
    createAuthorizationGuide(input)
      .then((nextBlob) => {
        if (!active) return
        url = URL.createObjectURL(nextBlob)
        setBlob(nextBlob)
        setPreviewUrl(url)
      })
      .catch(() => {
        if (active) toast.error("Não foi possível gerar a guia.")
      })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [input])

  function download() {
    if (!blob) return
    downloadBlob(blob, `guia-cuidarsaude-${credentials.number}.png`)
  }

  return (
    <div className="mt-5">
      <p className="text-sm font-medium">Guia de autorização</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Guia {credentials.number} · senha {credentials.password}. A imagem fica no aparelho.
      </p>
      <Button type="button" variant="outline" className="mt-3 h-12 w-full" disabled={!blob} onClick={download}>
        <Download />
        Baixar guia
      </Button>
      {previewUrl ? (
        <img src={previewUrl} alt={`Guia de autorização ${credentials.number}`} className="mt-3 w-full rounded-2xl border" />
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Gerando a guia…</p>
      )}
    </div>
  )
}
