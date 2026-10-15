import { DesktopShell } from "@/components/desktop/shell"

export default function DesktopLayout({ children }: LayoutProps<"/desktop">) {
  return <DesktopShell>{children}</DesktopShell>
}
