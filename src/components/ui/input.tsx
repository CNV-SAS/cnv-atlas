import * as React from "react"

import { cn } from "@/lib/utils"

// EL BOTON DE ARCHIVO SE VE COMO UN BOTON (cotejo 2026-09-05, punto 7). El default de shadcn lo deja
// `bg-transparent` y sin borde, asi que "Seleccionar archivo" y el nombre del archivo se leian como un solo
// texto corrido: Gildardo no encontro donde pulsar.
//
// POR QUE PERFILADO Y NO RELLENO (ajuste 2026-09-05): la primera version uso `secondary`, que es #f6f7f9,
// casi el blanco de la tarjeta donde vive: se veia igual de plano. Y `primary` relleno competiria con el
// boton de enviar, que esta justo debajo y SI es la accion principal. Un perfilado con el azul de marca
// resuelve las dos: se lee como control desde lejos y no disputa la jerarquia. Mas `cursor-pointer`, que
// era la otra mitad de lo que faltaba: sin el, nada indica que eso se pulsa.
//
// Se arregla en el PRIMITIVO y no en el formulario del BIS: el default plano es igual de confuso en el
// otro sitio donde hay un input de archivo (el RUT del profesional), y ahi nadie lo habia reportado.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:mr-3 file:inline-flex file:h-7 file:cursor-pointer file:items-center file:rounded-md file:border file:border-primary/35 file:bg-primary/8 file:px-3 file:text-sm file:font-semibold file:text-primary hover:file:border-primary/60 hover:file:bg-primary/15 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
