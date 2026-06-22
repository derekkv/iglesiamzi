"use client"


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useSecurityCheck } from "@/contexts/security-context"

export function SecurityKeyDialog() {
  const {
    isDialogOpen,
    setIsDialogOpen,
    keyInput,
    setKeyInput,
    isValidating,
    handleValidateKey,
  } = useSecurityCheck()

    console.log("Dialog render", isDialogOpen)
    
  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={setIsDialogOpen}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Autorización Requerida
          </DialogTitle>

          <DialogDescription>
            Este registro tiene más de 6 horas.
            Ingrese una clave de seguridad para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="security-key">
              Clave de Seguridad
            </Label>

            <Input
              id="security-key"
              value={keyInput}
              onChange={(e) =>
                setKeyInput(
                  e.target.value.toUpperCase()
                )
              }
              placeholder="Ingrese la clave"
              maxLength={6}
              className="uppercase"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleValidateKey()
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsDialogOpen(false)
              setKeyInput("")
            }}
            disabled={isValidating}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleValidateKey}
            disabled={isValidating}
          >
            {isValidating
              ? "Validando..."
              : "Validar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}