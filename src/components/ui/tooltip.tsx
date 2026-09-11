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

// EL RETARDO Y EL SALTO ENTRE VECINOS (Santiago, 2026-09-10): "a veces si cambio rapido se le dificulta
// para cambiar y queda mostrando el hover del icono del lado".
//
// SON DOS COSAS, Y SOLO UNA ERA EL ARREGLO. Lo que encadenaba un tooltip con el del vecino era
// `skipDelayDuration`: por defecto radix deja una ventana en la que el SIGUIENTE abre SIN esperar, asi que
// al recorrer una fila de botones se veia el del boton que ya se dejo atras. Con 0 cada uno espera su
// turno, y eso lo resuelve por si solo.
//
// SUBIR LA APERTURA A 250 ms FUE DE MAS (Santiago, 2026-09-10, tercera vuelta: "el tooltip sigue lento").
// Se subio en la MISMA tanda que el `skipDelayDuration`, atribuyendole al retardo un defecto que era del
// otro parametro, y el coste se paga en CADA hover: un cuarto de segundo antes de saber que hace un boton
// de icono. Baja a 125 ms, la mitad. El del vecino no vuelve porque su causa sigue cerrada.
function TooltipProvider({
  delayDuration = 125,
  skipDelayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
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
