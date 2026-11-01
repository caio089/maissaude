import { describe, expect, it } from "vitest"
import { formatDate } from "@/lib/format"

describe("formatDate", () => {
  it("formata datas válidas em string ou Date", () => {
    expect(formatDate(new Date(2026, 9, 31), "dd/MM/yyyy")).toBe("31/10/2026")
    expect(formatDate("2026-10-31T12:00:00Z", "yyyy-MM-dd")).toBe("2026-10-31")
  })

  it("não estoura RangeError para valores nulos, vazios ou inválidos", () => {
    expect(formatDate(undefined, "dd/MM/yyyy")).toBe("—")
    expect(formatDate(null, "dd/MM/yyyy")).toBe("—")
    expect(formatDate("", "dd/MM/yyyy")).toBe("—")
    expect(formatDate("invalid-date-string", "dd/MM/yyyy")).toBe("—")
    expect(formatDate(new Date("invalid"), "dd/MM/yyyy")).toBe("—")
  })
})

