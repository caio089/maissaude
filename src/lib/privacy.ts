import { cpfDigits } from "@/lib/cpf"

export function maskCpf(value: string) {
  const digits = cpfDigits(value)
  if (digits.length !== 11) return "CPF protegido"
  return `***.***.***-${digits.slice(-2)}`
}
