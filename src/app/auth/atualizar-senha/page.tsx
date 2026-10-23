import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { UpdatePasswordForm } from "@/components/auth/update-password-form"
import { currentAuthRole } from "@/lib/auth/role"

export const metadata: Metadata = { title: "Nova senha" }

export default async function UpdatePasswordPage() {
  if (!(await currentAuthRole())) redirect("/auth/recuperar")

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 ring-1 ring-foreground/10">
        <p className="section-kicker">CuidarSaude</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Nova senha</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Defina uma senha nova. Depois você volta para a área da sua conta.
        </p>
        <div className="mt-6">
          <UpdatePasswordForm />
        </div>
      </div>
    </main>
  )
}
