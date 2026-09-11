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
// EL RETARDO SE FUE BAJANDO EN DOS PASOS, y el destino es 50 ms (Santiago: "aun se nota el retraso").
// Estuvo en 250 por atribuirle al retardo un defecto que era del `skipDelayDuration`; con esa causa ya
// cerrada, el retardo solo tiene que hacer su trabajo original, que es no disparar el rotulo al cruzar por
// encima de camino a otra cosa. 50 ms bastan para eso (un cruce de raton dura menos) y por debajo del
// umbral en que la espera se percibe.
function TooltipProvider({
  delayDuration = 50,
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
