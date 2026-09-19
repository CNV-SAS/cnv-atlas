"use client";

import { Printer } from "lucide-react";
import type { ReactNode } from "react";

import { imprimirHoja } from "@/components/shared/imprimir-hoja";
import { Button } from "@/components/ui/button";

// ═══ LAS RUTAS DE ATENCION, EN PAPEL (2026-09-18) ═══
//
// SU ARCHIVO LAS IMPRIME, con un boton que se llama igual que este ("Imprimir / Guardar PDF"), y ese es el
// modelo que estamos adoptando: cada pantalla se imprime o se envia, en vez de un reporte global que el archivo
// de Gildardo no tiene.
//
// LA DIFERENCIA CON EL PLAN DEL PACIENTE: el plan es `solo-impresion` (existe en el DOM y solo se ve en papel)
// porque repetirlo en pantalla alargaria la vista del profesional con lo que ya tiene arriba. Aqui NO: las rutas
// SON la pantalla, asi que lo que se imprime es lo mismo que se esta mirando. Por eso esta hoja no se oculta.
//
// Y LLEVA ENCABEZADO, que en pantalla sobra y en papel no: una hoja suelta con rutas de atencion y sin decir de
// quien es ni quien la firma no es un documento, es un volante.
export function RutasImprimible({
  encabezado,
  children,
}: {
  encabezado: { profesional: string; profesion: string | null; paciente: string; documento: string | null; fecha: string };
  children: ReactNode;
}) {
  return (
    <div className="imprimible flex flex-col gap-3">
      <div className="no-print flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={(e) => imprimirHoja(e.currentTarget)}>
          <Printer className="size-4" aria-hidden />
          Imprimir / Guardar PDF
        </Button>
      </div>

      {/* SOLO EN PAPEL: en pantalla estos datos ya estan en la cabecera de la pagina. */}
      <div className="solo-impresion flex-col gap-1">
        <div>
          <p className="text-sm font-semibold text-foreground">{encabezado.profesional}</p>
          {encabezado.profesion ? (
            <p className="text-xs capitalize text-muted-foreground">{encabezado.profesion}</p>
          ) : null}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Rutas de atención</h2>
          <p className="text-xs text-muted-foreground">
            {[encabezado.paciente, encabezado.documento, encabezado.fecha].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}
