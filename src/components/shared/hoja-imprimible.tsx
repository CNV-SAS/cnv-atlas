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
  /** Anos cumplidos. Contextualiza lo que el documento dice (las porciones de un plan, por ejemplo). */
  edad?: number | null;
  fecha: string;
};

// ═══ EL ENCABEZADO, EN TRES BLOQUES (Santiago, 2026-09-19) ═══
//
// COMO ESTABA: el titulo del documento quedaba EN MEDIO de los datos ("Profesional / Nutricionista / Plan
// del paciente / Paciente · CC · edad · fecha"), y el paciente iba pegado a la fecha en una sola linea.
//
// COMO QUEDA, y por que es mejor: QUIEN LO FIRMA, A QUIEN VA DIRIGIDO, QUE ES Y DE CUANDO. Cada bloque
// responde una pregunta y se lee de un golpe; la fecha baja con el titulo, que es a lo que pertenece (es
// la fecha DEL documento, no un dato del paciente).
//
// ES UNO SOLO PARA LAS TRES HOJAS a proposito: el plan tenia el suyo copiado, y dos encabezados del mismo
// documento terminan diciendo cosas distintas.
export function EncabezadoImpreso({
  titulo,
  encabezado,
}: {
  titulo: string;
  encabezado: EncabezadoDeHoja;
}) {
  const identificacion = [
    encabezado.documento,
    encabezado.edad != null ? `${encabezado.edad} años` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Quien lo firma. */}
      <div>
        <p className="text-sm font-semibold text-foreground">{encabezado.profesional}</p>
        {encabezado.profesion ? (
          <p className="text-xs capitalize text-muted-foreground">{encabezado.profesion}</p>
        ) : null}
      </div>
      {/* 2. A quien va dirigido. */}
      <div>
        <p className="text-sm font-semibold text-foreground">{encabezado.paciente}</p>
        {identificacion ? <p className="text-xs text-muted-foreground">{identificacion}</p> : null}
      </div>
      {/* 3. Que documento es, y de cuando. */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{encabezado.fecha}</p>
      </div>
    </div>
  );
}

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

      <div className="solo-impresion flex-col">
        <EncabezadoImpreso titulo={titulo} encabezado={encabezado} />
      </div>

      {children}
    </div>
  );
}
