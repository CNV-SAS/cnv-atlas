"use client";

import { Printer } from "lucide-react";
import type { ReactNode } from "react";

import { imprimirHoja } from "@/components/shared/imprimir-hoja";
import { Button } from "@/components/ui/button";

// ═══ UNA PANTALLA QUE SE IMPRIME (2026-09-18) ═══
//
// EL MODELO ES EL DE GILDARDO: su archivo no tiene un reporte global, tiene cada pantalla con su boton de
// imprimir. Esto es el andamiaje comun, para que sumar una pantalla sea envolverla y no rehacer el mecanismo:
// el boton (que no sale en el papel), el encabezado que SOLO se ve impreso, y la marca que hace que salga
// ESTA hoja y no todas las que esten montadas (ver `imprimir-hoja`).
//
// EL ENCABEZADO VA EN PAPEL Y NO EN PANTALLA porque en pantalla ya esta arriba, en la cabecera de la pagina:
// repetirlo alarga la vista del profesional sin aportarle nada. Pero una hoja suelta que no dice de quien es
// ni quien la firma no es un documento clinico, es un volante.

export type EncabezadoDeHoja = {
  profesional: string;
  /** La profesion de quien firma. Un documento clinico no lo firma "alguien". */
  profesion: string | null;
  paciente: string;
  /** Tipo y numero de documento: lo que identifica el papel si se traspapela. */
  documento: string | null;
  fecha: string;
};

export function HojaImprimible({
  titulo,
  encabezado,
  etiquetaBoton = "Imprimir / Guardar PDF",
  children,
}: {
  titulo: string;
  encabezado: EncabezadoDeHoja;
  etiquetaBoton?: string;
  children: ReactNode;
}) {
  return (
    <div className="imprimible flex flex-col gap-3">
      <div className="no-print flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={(e) => imprimirHoja(e.currentTarget)}>
          <Printer className="size-4" aria-hidden />
          {etiquetaBoton}
        </Button>
      </div>

      <div className="solo-impresion flex-col gap-1">
        <div>
          <p className="text-sm font-semibold text-foreground">{encabezado.profesional}</p>
          {encabezado.profesion ? (
            <p className="text-xs capitalize text-muted-foreground">{encabezado.profesion}</p>
          ) : null}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
          <p className="text-xs text-muted-foreground">
            {[encabezado.paciente, encabezado.documento, encabezado.fecha].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}
