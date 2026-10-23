"use client"

import { useEffect, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { Logo } from "@/components/brand/logo"
import { retainDemoSync, useDemoStore } from "@/lib/store"

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const release = retainDemoSync()
    const align = () => {
      try {
        useDemoStore.getState().realignToToday()
      } catch (error) {
        console.error("Falha ao preparar a demonstração", error)
      }
    }
    align()
    queueMicrotask(() => setReady(true))
    const unsubscribe = useDemoStore.persist.onFinishHydration(align)
    if (!useDemoStore.persist.hasHydrated()) {
      void Promise.resolve(useDemoStore.persist.rehydrate()).finally(align)
    }
    return () => {
      unsubscribe()
      release()
    }
  }, [])

  return (
    <TooltipProvider>
      {ready ? children : <BootScreen />}
      <Toaster position="top-center" richColors closeButton />
    </TooltipProvider>
  )
}

function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo />
        <div>
          <p className="text-sm font-medium text-foreground">Preparando a demonstração</p>
          <p className="mt-1 text-sm text-muted-foreground">Carregando dados fictícios neste navegador.</p>
        </div>
      </div>
    </div>
  )
}
