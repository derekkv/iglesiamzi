import type { ReactNode } from "react"
import { LayoutWidthToggle } from "@/components/LayoutWidthToggle"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <LayoutWidthToggle />
    </>
  )
}
