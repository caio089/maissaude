import { Suspense } from "react"
import { MobileShell } from "@/components/mobile/shell"

export const instant = false

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <MobileShell>{children}</MobileShell>
    </Suspense>
  )
}

