"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">A demonstração encontrou um erro</h1>
        <p className="mt-2 text-sm text-muted-foreground">Recarregue a tela ou restaure o roteiro se o estado local tiver ficado inconsistente.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button type="button" onClick={reset}>Tentar de novo</Button>
          <Button asChild variant="outline"><Link href="/">Voltar ao início</Link></Button>
        </div>
      </div>
    </div>
  )
}
