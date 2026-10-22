"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateAccountPassword } from "@/lib/auth/patient-actions"
import { AUTH_PASSWORD_MIN } from "@/lib/auth/constants"
import { Field } from "@/components/shared/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function UpdatePasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setPending(true)
    setError("")
    const result = await updateAccountPassword(password)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    router.replace(result.next || "/")
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Field label="Nova senha" htmlFor="new-password" hint={`Mínimo de ${AUTH_PASSWORD_MIN} caracteres.`}>
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
          autoComplete="new-password"
        />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-11 w-full" disabled={pending || password.length < AUTH_PASSWORD_MIN}>
        {pending ? "Salvando…" : "Salvar senha"}
      </Button>
    </form>
  )
}
