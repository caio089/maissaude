"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Field } from "@/components/shared/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginClinic, type ClinicLoginState } from "@/lib/clinic-actions"

export function ClinicLoginForm() {
  const [state, action, pending] = useActionState(loginClinic, {} as ClinicLoginState)

  return (
    <form action={action} className="space-y-4">
      <Field label="E-mail da equipe" htmlFor="clinic-email">
        <Input
          id="clinic-email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="clinica@demonstracao.demo"
          required
          className="h-11"
        />
      </Field>
      <Field label="Senha" htmlFor="clinic-password">
        <Input
          id="clinic-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
        />
      </Field>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar no painel"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/auth/recuperar" className="text-teal hover:underline">Esqueci a senha</Link>
      </p>
    </form>
  )
}
