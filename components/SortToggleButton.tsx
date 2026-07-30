"use client"

import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

interface SortToggleButtonProps {
  ascending: boolean
  onToggle: () => void
  label?: string
}

export function SortToggleButton({ ascending, onToggle, label }: SortToggleButtonProps) {
  return (
    <Button variant="outline" size="sm" onClick={onToggle} className="flex items-center gap-1 text-xs">
      {ascending ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {label || (ascending ? "Antiguo primero" : "Reciente primero")}
    </Button>
  )
}
