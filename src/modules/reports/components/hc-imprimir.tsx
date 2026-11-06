import { Printer } from "lucide-react";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// IMPRIMIR / GUARDAR LA HISTORIA CLINICA  ·  AHORA EL PDF DEL SERVIDOR (2026-11-03)
//
// ═══ POR QUE DEJO DE SER `window.print()` ═══
//
// Santiago, sobre la HC descargada: *"Muestra la URL del paciente incluido el origen. Considero que esto
// no debería de aparecer."* Y en cada hoja salia ademas la fecha y hora de impresion y el "5/9".
//
// ESO NO LO PONE ATLAS, LO PONE EL NAVEGADOR al imprimir una pagina, y no hay CSS que lo quite: es
// configuracion del dialogo de impresion de cada persona. Mientras el boton imprimiera la pantalla, la
// URL completa de la consulta iba a seguir saliendo en un documento clinico que se puede entregar.
//
// ═══ Y EL ARGUMENTO QUE SOSTENIA LA DECISION ANTERIOR YA NO SE SOSTIENE ═══
//
// Era bueno y estaba escrito aqui: *"generar la historia otra vez en el servidor exigiria una SEGUNDA
// construccion del mismo documento, y dos construcciones del mismo insumo se desincronizan sin que nada
// avise"*. Lo que cambio no es el argumento, es el HECHO: esa segunda construccion YA EXISTE
// (`HistoriaClinicaDocument`) y es la que se le ENVIA al paciente cuando la pide.
//
// Asi que no se elegia entre una construccion y dos: YA HABIA DOS, y el boton usaba la que mete la URL en
// el papel. Apuntarlo a la otra REDUCE las superficies en uso, no las aumenta.
//
// Y DE PASO CIERRA LOS DOS DEFECTOS DE MAQUETACION que Santiago reporto dos veces (el recuadro cortado a
// medias y el titulo solo en una hoja casi vacia): el documento del servidor controla sus saltos con
// `wrap`, no con las reglas de impresion de un navegador, que son una preferencia que el puede ignorar.
//
// ═══ UN ENLACE, NO UN BOTON CON JAVASCRIPT ═══
//
// La descarga la resuelve el navegador, asi que funciona igual en un telefono y este componente deja de
// necesitar `"use client"`. `target="_blank"` abre el visor sin perder la consulta que el profesional
// tiene abierta, que es justo lo que estaba haciendo cuando pulso.
//
// LA PANTALLA SIGUE SIENDO IMPRIMIBLE con Ctrl+P y su hoja `imprimible`: lo que cambia es a donde apunta
// el BOTON. Quien prefiera imprimir lo que ve, puede.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export function HcImprimir({ evaluationId }: { evaluationId: string }) {
  return (
    <a
      href={`/ani-bis-e/${evaluationId}/hc/pdf`}
      target="_blank"
      rel="noopener"
      // `no-print`: el boton no sale en el papel. Un documento clinico con un boton impreso encima se ve
      // como una captura de pantalla, no como un documento.
      className="no-print inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Printer className="size-4" aria-hidden />
      {/* ═══ "IMPRIMIR/DESCARGAR", NO SOLO "IMPRIMIR" (Santiago, 2026-11-05) ═══

          El boton dejo de ser `window.print()` el 3 de noviembre y paso a abrir el PDF del servidor, y el
          rotulo se quedo con la palabra de antes. Lo que hace ahora es ABRIR UN PDF: imprimirlo es una de
          las dos cosas que se pueden hacer con el, y la otra (guardarlo) es la que un profesional necesita
          cuando el paciente le pide su historia por otro canal.

          "Imprimir" a secas hacia pensar que se iba al dialogo del navegador, que es justo lo que se quito
          para que la URL de la consulta dejara de salir en el papel. */}
      Imprimir/descargar HC
    </a>
  );
}
