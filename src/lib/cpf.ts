export function cpfDigits(value: string) {
  return value.replace(/\D/g, "")
}

export function isValidCpf(value: string) {
  const digits = cpfDigits(value)
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false

  const digit = (length: number) => {
    const total = digits
      .slice(0, length)
      .split("")
      .reduce((sum, item, index) => sum + Number(item) * (length + 1 - index), 0)
    const remainder = (total * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return digit(9) === Number(digits[9]) && digit(10) === Number(digits[10])
}

export function formatCpf(value: string) {
  const digits = cpfDigits(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}
