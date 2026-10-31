import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { printAuthorizationGuide } from "@/lib/authorization-guide"

describe("printAuthorizationGuide", () => {
  const originalDocument = globalThis.document

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.document = originalDocument
  })

  it("cria um iframe de impressão, carrega o blob da imagem e invoca print", async () => {
    const mockPrint = vi.fn()
    const mockRevoke = vi.fn()
    globalThis.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-guide-url")
    globalThis.URL.revokeObjectURL = mockRevoke

    let triggerOnload: (() => void) | null = null
    const mockIframe: {
      style: Record<string, string>
      contentWindow: {
        print: () => void
        focus: () => void
        document: { open: () => void; write: (html: string) => void; close: () => void }
      }
      parentNode: { removeChild: (node: unknown) => void } | null
      onload: (() => void) | null
    } = {
      style: {},
      contentWindow: {
        print: mockPrint,
        focus: vi.fn(),
        document: {
          open: vi.fn(),
          write: vi.fn(),
          close: vi.fn(),
        },
      },
      parentNode: null,
      onload: null,
    }

    const mockDoc = {
      createElement: vi.fn((tag: string) => {
        if (tag === "iframe") return mockIframe
        return {}
      }),
      body: {
        appendChild: vi.fn((node: any) => {
          node.parentNode = mockDoc.body
          triggerOnload = node.onload
          return node
        }),
        removeChild: vi.fn((node: any) => {
          node.parentNode = null
          return node
        }),
      },
    }

    // @ts-expect-error Mocking document for node environment
    globalThis.document = mockDoc

    const blob = new Blob(["fake-image-bytes"], { type: "image/png" })
    const printPromise = printAuthorizationGuide(blob, "Guia 123456.1")

    expect(mockDoc.createElement).toHaveBeenCalledWith("iframe")
    expect(mockDoc.body.appendChild).toHaveBeenCalledWith(mockIframe)

    if (triggerOnload) (triggerOnload as () => void)()

    await printPromise
    expect(mockPrint).toHaveBeenCalled()
    expect(mockRevoke).toHaveBeenCalledWith("blob:http://localhost/mock-guide-url")
  })
})
