import { MobileShell } from "@/components/mobile/shell"

export default function MobileLayout({ children }: LayoutProps<"/mobile">) {
  return <MobileShell>{children}</MobileShell>
}
