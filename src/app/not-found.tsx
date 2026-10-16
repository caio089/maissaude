import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">Essa rota não faz parte da demonstração CuidarSaude.</p>
        <Button asChild className="mt-4"><Link href="/">Voltar ao início</Link></Button>
      </div>
    </div>
  )
}
