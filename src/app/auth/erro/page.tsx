import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center ring-1 ring-foreground/10">
        <h1 className="text-2xl font-semibold">Link inválido</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Este link de recuperação expirou ou já foi usado. Solicite outro a partir da tela de entrada.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/auth/recuperar">Pedir novo link</Link>
        </Button>
      </div>
    </main>
  )
}
