import type { Metadata } from "next"
import { DemoGuide } from "@/components/demo/demo-guide"

export const metadata: Metadata = { title: "Roteiro da apresentação" }

export default function DemoPage() {
  return <DemoGuide />
}
