"use client";

import type { ReactNode } from "react";

import { BarraDeImpresion } from "@/components/shared/barra-de-impresion";

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
  queSale,
  motivoApagado = null,
  children,
}: {
  titulo: string;
  encabezado: EncabezadoDeHoja;
  etiquetaBoton?: string;
  /**
   * QUE SALE EN EL PAPEL, en una linea. Obligatorio desde el 2026-10-25, cuando el boton paso a estar en
   * todas las subpestañas: con ocho botones iguales en ocho pantallas, el unico que distingue uno de otro
   * es lo que dice que imprime. Sin esta linea, "Imprimir" en la pestaña de Encuesta y "Imprimir" en la de
   * Composicion se leen igual, y quien pulsa no sabe que va a salir.
   */
  queSale: string;
  /** Por que no se puede imprimir ahora (apaga el boton y se dice en su rotulo). Ver `BarraDeImpresion`. */
  motivoApagado?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="imprimible flex flex-col gap-3">
      {/* ARRIBA, Y EL MISMO BLOQUE EN TODAS (Gildardo, 2026-10-25). Antes era un boton suelto alineado a
          la derecha, sin decir que imprimia; ahora es el bloque compartido, que es como "igual en todas"
          deja de depender de que alguien lo repita bien. Y va DENTRO de la hoja a proposito: el boton sube
          buscando su `.imprimible` para marcarla. */}
      <BarraDeImpresion
        titulo={titulo}
        descripcion={queSale}
        etiqueta={etiquetaBoton}
        motivoApagado={motivoApagado}
      />

      <div className="solo-impresion flex-col">
        <EncabezadoImpreso titulo={titulo} encabezado={encabezado} />
      </div>

      {children}
    </div>
  );
}
