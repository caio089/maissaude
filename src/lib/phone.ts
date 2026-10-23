export function phoneDigits(value: string) {
  return value.replace(/\D/g, "")
}

/** Aceita número brasileiro com DDD, com ou sem pontuação e com 55 opcional. */
export function isValidPhone(value: string) {
  const digits = phoneDigits(value)
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits
  return national.length === 10 || national.length === 11
}
