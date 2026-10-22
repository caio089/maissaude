import type { Metadata } from "next"
import Link from "next/link"
import { RecoverPasswordForm } from "@/components/auth/recover-password-form"

export const metadata: Metadata = { title: "Recuperar senha" }

export default function RecoverPasswordPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 ring-1 ring-foreground/10">
        <p className="section-kicker">CuidarSaude</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Recuperar senha</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Informe o e-mail da conta ou o CPF fictício do aplicativo. Se a conta existir no Auth, enviamos o link para criar uma nova senha.
        </p>
        <div className="mt-6">
          <RecoverPasswordForm />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/desktop/entrar" className="hover:text-foreground">Painel da clínica</Link>
          {" · "}
          <Link href="/mobile" className="hover:text-foreground">Aplicativo</Link>
        </p>
      </div>
    </main>
  )
}
