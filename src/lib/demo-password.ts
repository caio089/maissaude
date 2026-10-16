export async function hashDemoPassword(password: string) {
  const encoded = new TextEncoder().encode(`cuidar-saude-demo|${password}`)
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
