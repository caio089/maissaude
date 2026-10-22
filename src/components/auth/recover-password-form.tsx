"use client"

import { useState } from "react"
import { recoverClinicPassword } from "@/lib/clinic-actions"
import { recoverPatientPassword } from "@/lib/auth/patient-actions"
import { CLINIC_AUTH_EMAIL } from "@/lib/auth/constants"
import { Field } from "@/components/shared/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function RecoverPasswordForm({ defaultIdentity = "" }: { defaultIdentity?: string }) {
  const [identity, setIdentity] = useState(defaultIdentity)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function submit() {
    setPending(true)
    setError("")
    setNotice("")
    const value = identity.trim()
    const result = value.toLowerCase() === CLINIC_AUTH_EMAIL
      ? await recoverClinicPassword(value)
      : await recoverPatientPassword(value)
    setPending(false)
    if ("error" in result && result.error) {
      setError(result.error)
      return
    }
    if ("ok" in result && result.ok === false) {
      setError(result.message)
      return
    }
    setNotice("notice" in result && result.notice ? result.notice : "Se a conta existir, enviamos o e-mail de recuperação.")
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Field label="E-mail ou CPF" htmlFor="recover-identity">
        <Input
          id="recover-identity"
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
          placeholder="email@dominio.com ou 900.000.000-00"
          className="h-11"
          autoComplete="username"
        />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-teal">{notice}</p> : null}
      <Button type="submit" className="h-11 w-full" disabled={pending || identity.trim().length < 3}>
        {pending ? "Enviando…" : "Enviar link"}
      </Button>
    </form>
  )
}
