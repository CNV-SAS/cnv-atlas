"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// EXISTE POR EL ROTULO FLOTANTE DE LA BARRA COLAPSADA, y la razon es tecnica, no de gusto.
//
// La version anterior pintaba el rotulo con `position: absolute` dentro del propio enlace, y quedaba
// RECORTADO: la barra necesita `overflow-y: auto` para no perder items cuando la lista es mas larga que la
// pantalla, y CSS convierte el `overflow-x: visible` del otro eje en `auto` en cuanto uno de los dos
// recorta. O sea que no habia forma de sacar el rotulo sin renunciar al desplazamiento, y renunciar a el
// deja items INALCANZABLES en una pantalla corta, que es peor que un rotulo que no se ve.
//
// El portal lo resuelve: el rotulo se pinta fuera del arbol de la barra, asi que ningun `overflow` lo
// alcanza. Y ademas trae de serie lo que habria que escribir a mano: aparece con el foco del teclado, se
// cierra con Escape, y se anuncia como descripcion del enlace.

function TooltipProvider({
  delayDuration = 120,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground shadow-md",
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
