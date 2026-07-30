import * as React from "react"

import { cn } from "@/lib/utils"

// Tipos de input que NO deben convertirse a uppercase
const NO_UPPERCASE_TYPES = ["password", "email", "date", "time", "datetime-local", "number", "color", "file", "hidden", "range"]

interface InputProps extends React.ComponentProps<"input"> {
  noUppercase?: boolean
}

function Input({ className, type, onChange, noUppercase, ...props }: InputProps) {
  const shouldUppercase = !noUppercase && !NO_UPPERCASE_TYPES.includes(type || "text")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (shouldUppercase && e.target.value) {
      e.target.value = e.target.value.toUpperCase()
    }
    onChange?.(e)
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        noUppercase && "!normal-case",
        className
      )}
      onChange={handleChange}
      {...props}
    />
  )
}

export { Input }
