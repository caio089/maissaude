"use client"

import { useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { retainDemoSync, useDemoStore } from "@/lib/store"

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const release = retainDemoSync()
    const align = () => {
      try {
        useDemoStore.getState().realignToToday()
      } catch (error) {
        console.error("Falha ao preparar os dados locais", error)
      }
    }
    align()
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
      {children}
      <Toaster position="top-center" richColors closeButton />
    </TooltipProvider>
  )
}

