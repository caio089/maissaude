export function whatsAppLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "")
  const international = digits.startsWith("55") ? digits : `55${digits}`
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`
}
