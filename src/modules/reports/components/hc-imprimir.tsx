"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

// IMPRIMIR / GUARDAR LA HISTORIA CLINICA COMO PDF.
//
// POR QUE `window.print()` Y NO UN PDF GENERADO EN EL SERVIDOR, que es la decision de fondo de esta pieza:
//
// La historia clinica ya esta renderizada en esta pantalla, con sus quince bloques, sus tablas y sus
// indices. Generarla otra vez en el servidor exigiria una SEGUNDA construccion del mismo documento (con
// @react-pdf, que tiene sus propias primitivas y no entiende este HTML), y dos construcciones del mismo
// insumo es exactamente el defecto que llevamos una semana cerrando: la segunda hereda los huecos que la
// primera ya resolvio, y se desincronizan sin que nada avise.
//
// Con `print()` lo que se imprime ES lo que se ve, por construccion. No hay nada que sincronizar.
//
// LO QUE ESTE CAMINO NO DA, y por eso el envio al paciente es una pieza aparte: no produce bytes en el
// servidor, asi que no se puede adjuntar a un correo. Esa mitad necesita una decision (adjunto contra
// enlace) y no se toma aqui.
//
// Es ademas lo que hace el prototipo de Gildardo: sus seis botones de impresion son `window.print()`.

export function HcImprimir() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      // `no-print`: el boton no sale en el papel. Un documento clinico con un boton impreso encima se ve
      // como una captura de pantalla, no como un documento.
      className="no-print self-start"
      onClick={() => window.print()}
    >
      <Printer className="size-4" aria-hidden />
      Imprimir o guardar PDF
    </Button>
  );
}
