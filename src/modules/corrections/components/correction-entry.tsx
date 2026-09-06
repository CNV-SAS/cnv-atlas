import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { CorrectionAvailability } from "../data/correction-availability-reader";

// Punto de entrada al flujo de CORRECCIÓN (S2). DELIBERADAMENTE distinto de los actos de SELLADO
// (confirmar diagnóstico, aprobar protocolo, aprobar reporte): esos son primarios/rellenos y avanzan;
// corregir es lo opuesto (rehace una emisión ya sellada). Por eso vive en un recuadro tenue aparte, con
// botón de contorno (no relleno) y una pregunta que invita a pensarlo, no un CTA que empuja a hacerlo.
// DONDE VIVE, y el comentario decia otra cosa: aparece en UN sitio, la card "Cierre del diagnóstico" al
// pie de Diagnóstico Funcional, emparejado con confirmar ("dos caminos: confirmar o corregir"). Decia
// "al pie de las tres pestañas", que fue cierto y dejo de serlo. Solo con diagnóstico ya emitido: sin
// emisión sellada no hay nada que rehacer (antes se edita la entrada directamente).
//
// HAY UN SEGUNDO CAMINO Y NO SOBRA (cotejo 2026-09-05, punto 14): la subpestaña de la encuesta lleva el
// mismo botón. Son dos MOMENTOS distintos, no una repetición: allá el profesional está mirando las
// respuestas y ve la equivocada; aquí está leyendo el diagnóstico y se da cuenta de que un dato no
// cuadra. Quitar este obligaría a ir a buscarlo justo cuando surge la necesidad.
//
// LO QUE SI SOBRABA ERA EL TEXTO. Iban tres párrafos, y dos eran la explicación del ALCANCE, que está
// verbatim en la pantalla de corrección, que es adonde lleva el botón. Peor: uno de ellos explicaba que
// la medición se puede volver a importar "mientras no haya diagnóstico", y este bloque SOLO se muestra
// cuando ya lo hay, así que describía un camino cerrado en el momento de leerlo.
//
// availability lo resuelve la página; CP3: si la evaluación es de una versión anterior
// de la encuesta, el botón se muestra DESHABILITADO con la razón (estado, no un error al pulsar).
export function CorrectionEntry({
  evaluationId,
  availability,
}: {
  evaluationId: string;
  availability: CorrectionAvailability;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold text-foreground">¿Un dato de la encuesta quedó mal?</h3>
      <p className="max-w-prose text-sm text-muted-foreground">
        Corrige la respuesta equivocada. Se genera una versión nueva del diagnóstico, el tratamiento y el
        reporte con el dato corregido; la versión actual no se borra, queda registrada como reemplazada.
      </p>
      <p className="max-w-prose text-xs text-muted-foreground">
        Aquí solo se corrige la encuesta. Con el diagnóstico ya generado, la medición del equipo y la
        identidad del paciente no se corrigen: escríbele a soporte.
      </p>
      {availability.available ? (
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/evaluaciones/${evaluationId}/corregir`}>Corregir la evaluación</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Button variant="outline" size="sm" disabled>
            Corregir la evaluación
          </Button>
          {availability.blockedReason ? (
            <p className="text-xs text-muted-foreground">{availability.blockedReason}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
